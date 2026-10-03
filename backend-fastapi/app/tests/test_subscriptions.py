import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import re

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import subscription_routes
from app.database.database import Base
from app.models.field_model import Field
from app.models.payment_model import Payment
from app.models.premium_trial_usage_model import PremiumTrialUsage
from app.models.routes_model import Route
from app.models.subscription_model import Subscription
from app.models.user_model import User
from app.services import mercadopago_service


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        bind=engine,
        tables=[
            User.__table__,
            Subscription.__table__,
            Payment.__table__,
            PremiumTrialUsage.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(
            bind=engine,
            tables=[
                PremiumTrialUsage.__table__,
                Payment.__table__,
                Subscription.__table__,
                User.__table__,
            ],
        )
        engine.dispose()


def make_user(db, email: str) -> User:
    user = User(email=email, password="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_subscription(db, user: User, status: str = "PENDING") -> Subscription:
    subscription = Subscription(
        user_id=user.id,
        mercado_pago_subscription_id="mp-sub-1",
        external_reference=f"agroroute:{user.id}:sub-1",
        plan="PREMIUM_MONTHLY",
        status=status,
        amount=Decimal("8.99"),
        currency="BRL",
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def make_pix_subscription(db, user: User, status: str = "PENDING") -> Subscription:
    subscription = Subscription(
        user_id=user.id,
        external_reference=f"agroroute:{user.id}:pix-sub",
        plan="PREMIUM_MONTHLY",
        status=status,
        amount=Decimal("8.99"),
        currency="BRL",
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def test_webhook_signature_validation():
    secret = "test-webhook-secret"
    resource_id = "abC123"
    request_id = "request-123"
    timestamp = "1700000000"
    manifest = f"id:{resource_id.lower()};request-id:{request_id};ts:{timestamp};"
    digest = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()

    assert subscription_routes._webhook_signature_is_valid(
        secret=secret,
        signature_header=f"ts={timestamp},v1={digest}",
        request_id=request_id,
        resource_id=resource_id,
    )
    assert not subscription_routes._webhook_signature_is_valid(
        secret=secret,
        signature_header=f"ts={timestamp},v1={digest}",
        request_id=request_id,
        resource_id="different-id",
    )
    assert not subscription_routes._webhook_signature_is_valid(
        secret=secret,
        signature_header=None,
        request_id=request_id,
        resource_id=resource_id,
    )


def test_monthly_amount_defaults_to_899(monkeypatch):
    monkeypatch.delenv("MP_PREMIUM_MONTHLY_AMOUNT", raising=False)

    assert subscription_routes.mp_service.get_monthly_amount() == (8.99, "BRL")


def test_monthly_amount_uses_environment_configuration(monkeypatch):
    monkeypatch.setenv("MP_PREMIUM_MONTHLY_AMOUNT", "12.34")

    assert subscription_routes.mp_service.get_monthly_amount() == (12.34, "BRL")


def test_provider_error_keeps_safe_diagnostics():
    with pytest.raises(mercadopago_service.MercadoPagoServiceError) as error:
        mercadopago_service._checked(
            {
                "status": 400,
                "response": {
                    "error": "bad_request",
                    "message": "Invalid card token",
                    "cause": [
                        {
                            "code": 2006,
                            "description": "Card token is invalid",
                            "card_token_id": "must-not-be-logged",
                        }
                    ],
                },
            }
        )

    assert "HTTP 400" in str(error.value)
    assert "bad_request" in str(error.value)
    assert "2006: Card token is invalid" in str(error.value)
    assert "must-not-be-logged" not in str(error.value)


def test_create_subscription_uses_backend_price_and_creates_pending(
    db, monkeypatch
):
    user = make_user(db, "create@agro.test")
    captured: dict = {}
    monkeypatch.delenv("MP_PREMIUM_MONTHLY_AMOUNT", raising=False)
    monkeypatch.setattr(subscription_routes, "_get_frontend_url", lambda: "https://agro.test")

    def create_remote(data):
        captured.update(data)
        return {
            "id": "mp-sub-1",
            "status": "authorized",
            "external_reference": data["external_reference"],
        }

    monkeypatch.setattr(
        subscription_routes.mp_service,
        "create_subscription",
        create_remote,
    )
    result = subscription_routes.create_subscription(
        subscription_routes.CreateSubscriptionRequest(card_token_id="temporary-token"),
        db,
        user,
    )

    assert result["subscription"]["status"] == "PENDING"
    assert result["subscription"]["amount"] == 8.99
    assert captured["auto_recurring"]["transaction_amount"] == 8.99
    assert "user_id" not in captured
    assert captured["card_token_id"] == "temporary-token"
    assert db.query(Subscription).count() == 1


def test_create_pix_payment_returns_provider_qr_and_uses_configured_price(
    db,
    monkeypatch,
):
    user = make_user(db, "pix@agro.test")
    captured: dict = {}
    monkeypatch.delenv("MP_PREMIUM_MONTHLY_AMOUNT", raising=False)
    monkeypatch.setattr(
        subscription_routes,
        "_get_frontend_url",
        lambda: "https://agro.test",
    )

    def create_payment(data, idempotency_key):
        captured.update(data)
        captured["idempotency_key"] = idempotency_key
        return {
            "id": "mp-pix-1",
            "status": "pending",
            "status_detail": "pending_waiting_payment",
            "payment_method_id": "pix",
            "external_reference": data["external_reference"],
            "transaction_amount": 8.99,
            "currency_id": "BRL",
            "date_created": "2026-10-03T12:00:00Z",
            "date_last_updated": "2026-10-03T12:00:00Z",
            "date_of_expiration": "2026-10-03T12:30:00Z",
            "point_of_interaction": {
                "transaction_data": {
                    "qr_code": "pix-copy-paste",
                    "qr_code_base64": "encoded-image",
                    "ticket_url": "https://agro.test/ticket",
                }
            },
        }

    monkeypatch.setattr(
        subscription_routes.mp_service,
        "create_payment",
        create_payment,
    )
    result = subscription_routes.create_pix_payment(
        subscription_routes.CreatePixPaymentRequest(cpf="123.456.789-00"),
        db,
        user,
    )

    assert result["subscription"]["status"] == "PENDING"
    assert result["subscription"]["payment_method"] == "pix"
    assert result["pix"]["qr_code"] == "pix-copy-paste"
    assert result["pix"]["qr_code_base64"] == "encoded-image"
    assert captured["transaction_amount"] == 8.99
    assert captured["payment_method_id"] == "pix"
    assert re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-03:00",
        captured["date_of_expiration"],
    )
    assert captured["payer"]["identification"] == {
        "type": "CPF",
        "number": "12345678900",
    }
    assert captured["idempotency_key"].startswith("agro-pix-")
    assert db.query(Payment).one().status == "pending"


def test_create_pix_payment_reuses_existing_pending_qr(db, monkeypatch):
    user = make_user(db, "pix-reuse@agro.test")
    subscription = make_pix_subscription(db, user)
    payment = Payment(
        subscription_id=subscription.id,
        mercado_pago_payment_id="mp-pix-existing",
        amount=Decimal("8.99"),
        currency="BRL",
        status="pending",
        payment_date=datetime(2026, 10, 3, 12, tzinfo=timezone.utc),
        provider_updated_at=datetime(2026, 10, 3, 12, tzinfo=timezone.utc),
    )
    db.add(payment)
    db.commit()
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_monthly_amount",
        lambda: (8.99, "BRL"),
    )
    monkeypatch.setattr(
        subscription_routes,
        "_get_frontend_url",
        lambda: "https://agro.test",
    )
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "create_payment",
        lambda *_args, **_kwargs: pytest.fail(
            "A valid pending PIX payment should be reused."
        ),
    )
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_payment",
        lambda payment_id: {
            "id": payment_id,
            "status": "pending",
            "payment_method_id": "pix",
            "external_reference": subscription.external_reference,
            "transaction_amount": 8.99,
            "currency_id": "BRL",
            "date_created": "2026-10-03T12:00:00Z",
            "date_last_updated": "2026-10-03T12:00:00Z",
            "date_of_expiration": "2026-10-04T12:30:00Z",
            "point_of_interaction": {
                "transaction_data": {"qr_code": "existing-pix-code"}
            },
        },
    )

    result = subscription_routes.create_pix_payment(
        subscription_routes.CreatePixPaymentRequest(cpf="12345678900"),
        db,
        user,
    )

    assert result["pix"]["payment_id"] == "mp-pix-existing"
    assert result["pix"]["qr_code"] == "existing-pix-code"
    assert db.query(Payment).count() == 1


def test_approved_pix_payment_activates_one_month_without_recurring_api(
    db,
    monkeypatch,
):
    user = make_user(db, "pix-approved@agro.test")
    subscription = make_pix_subscription(db, user)
    paid_at = datetime.now(timezone.utc)
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_subscription",
        lambda *_args: pytest.fail("PIX has no recurring preapproval."),
    )

    result = subscription_routes._store_payment(
        db,
        {
            "id": "mp-pix-approved",
            "external_reference": subscription.external_reference,
            "transaction_amount": 8.99,
            "currency_id": "BRL",
            "payment_method_id": "pix",
            "status": "approved",
            "date_created": paid_at.isoformat(),
            "date_approved": paid_at.isoformat(),
            "date_last_updated": paid_at.isoformat(),
        },
    )

    assert result is not None
    assert result.status == "ACTIVE"
    assert result.next_payment_date is not None
    assert result.next_payment_date.month == _next_month_number(paid_at.month)
    assert db.query(Payment).one().status == "approved"


def test_get_my_subscription_reconciles_pending_pix_payment(db, monkeypatch):
    user = make_user(db, "pix-refresh@agro.test")
    subscription = make_pix_subscription(db, user)
    created_at = datetime.now(timezone.utc)
    db.add(
        Payment(
            subscription_id=subscription.id,
            mercado_pago_payment_id="mp-pix-refresh",
            amount=Decimal("8.99"),
            currency="BRL",
            status="pending",
            payment_date=created_at,
            provider_updated_at=created_at,
        )
    )
    db.commit()
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_payment",
        lambda payment_id: {
            "id": payment_id,
            "external_reference": subscription.external_reference,
            "transaction_amount": 8.99,
            "currency_id": "BRL",
            "payment_method_id": "pix",
            "status": "approved",
            "date_created": created_at.isoformat(),
            "date_approved": created_at.isoformat(),
            "date_last_updated": (created_at + timedelta(seconds=2)).isoformat(),
        },
    )

    result = subscription_routes.get_my_subscription(db, user)

    assert result["subscription"]["status"] == "ACTIVE"
    assert db.query(Payment).one().status == "approved"


def _next_month_number(month: int) -> int:
    return month % 12 + 1


def test_expired_pix_period_loses_premium_access(db):
    user = make_user(db, "pix-expired@agro.test")
    subscription = make_pix_subscription(db, user, "ACTIVE")
    old_paid_at = datetime(2026, 7, 1, tzinfo=timezone.utc)
    subscription.next_payment_date = datetime(2026, 8, 1, tzinfo=timezone.utc)
    db.add(
        Payment(
            subscription_id=subscription.id,
            mercado_pago_payment_id="mp-pix-expired",
            amount=Decimal("8.99"),
            currency="BRL",
            status="approved",
            payment_date=old_paid_at,
            provider_updated_at=old_paid_at,
        )
    )
    db.commit()

    with pytest.raises(HTTPException) as error:
        subscription_routes.get_current_premium_user(user, db)

    assert error.value.status_code == 402
    db.refresh(subscription)
    assert subscription.status == "PAST_DUE"


def test_create_subscription_rejects_duplicate_open_subscription(db, monkeypatch):
    user = make_user(db, "duplicate@agro.test")
    make_subscription(db, user)
    monkeypatch.setattr(subscription_routes.mp_service, "get_monthly_amount", lambda: (8.99, "BRL"))
    monkeypatch.setattr(subscription_routes, "_get_frontend_url", lambda: "https://agro.test")

    with pytest.raises(HTTPException) as error:
        subscription_routes.create_subscription(
            subscription_routes.CreateSubscriptionRequest(card_token_id="token"),
            db,
            user,
        )
    assert error.value.status_code == 409


def test_open_subscription_database_constraint(db):
    user = make_user(db, "constraint@agro.test")
    make_subscription(db, user)
    duplicate = Subscription(
        user_id=user.id,
        external_reference="agroroute:duplicate",
        plan="PREMIUM_MONTHLY",
        status="PENDING",
        amount=Decimal("8.99"),
        currency="BRL",
    )
    db.add(duplicate)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_canceled_subscription_allows_new_subscription(db, monkeypatch):
    user = make_user(db, "renew@agro.test")
    old = make_subscription(db, user, "CANCELED")
    monkeypatch.setattr(subscription_routes.mp_service, "get_monthly_amount", lambda: (8.99, "BRL"))
    monkeypatch.setattr(subscription_routes, "_get_frontend_url", lambda: "https://agro.test")
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "create_subscription",
        lambda data: {
            "id": "mp-sub-2",
            "status": "authorized",
            "external_reference": data["external_reference"],
        },
    )

    result = subscription_routes.create_subscription(
        subscription_routes.CreateSubscriptionRequest(card_token_id="token"),
        db,
        user,
    )

    assert old.status == "CANCELED"
    assert result["subscription"]["status"] == "PENDING"
    assert db.query(Subscription).count() == 2


def test_get_my_subscription_and_owner_isolation(db):
    owner = make_user(db, "owner@agro.test")
    other_user = make_user(db, "other@agro.test")
    subscription = make_subscription(db, owner)

    assert subscription_routes.get_my_subscription(db, owner)["subscription"]["id"] == subscription.id
    assert subscription_routes.get_my_subscription(db, other_user)["subscription"] is None
    with pytest.raises(HTTPException) as error:
        subscription_routes._find_user_open_subscription(db, other_user.id)
    assert error.value.status_code == 404


@pytest.mark.parametrize(
    ("payment_status", "expected_subscription_status"),
    [
        ("pending", "PENDING"),
        ("approved", "ACTIVE"),
        ("rejected", "PAST_DUE"),
        ("refunded", "PAST_DUE"),
    ],
)
def test_payment_webhook_sync_and_idempotency(
    db,
    monkeypatch,
    payment_status,
    expected_subscription_status,
):
    user = make_user(db, f"{payment_status}@agro.test")
    subscription = make_subscription(db, user)
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_subscription",
        lambda subscription_id: {
            "id": subscription_id,
            "status": "authorized",
            "external_reference": subscription.external_reference,
            "date_created": "2026-10-01T12:00:00Z",
            "next_payment_date": "2026-11-01T12:00:00Z",
        },
    )
    payment = {
        "id": "mp-payment-1",
        "preapproval_id": "mp-sub-1",
        "external_reference": subscription.external_reference,
        "transaction_amount": 8.99,
        "currency_id": "BRL",
        "status": payment_status,
        "date_created": "2026-10-03T12:00:00Z",
        "date_approved": (
            "2026-10-03T12:00:00Z" if payment_status == "approved" else None
        ),
    }

    subscription_routes._store_payment(db, payment)
    subscription_routes._store_payment(db, payment)

    assert db.query(Payment).count() == 1
    assert db.query(Payment).one().status == payment_status
    db.refresh(subscription)
    assert subscription.status == expected_subscription_status


def test_payment_with_wrong_amount_cannot_activate_subscription(db, monkeypatch):
    user = make_user(db, "wrong-amount@agro.test")
    subscription = make_subscription(db, user)
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_subscription",
        lambda subscription_id: {
            "id": subscription_id,
            "status": "authorized",
            "external_reference": subscription.external_reference,
        },
    )
    subscription_routes._store_payment(
        db,
        {
            "id": "mp-payment-wrong-amount",
            "preapproval_id": "mp-sub-1",
            "transaction_amount": 1.0,
            "currency_id": "BRL",
            "status": "approved",
            "date_created": datetime.now(timezone.utc).isoformat(),
        },
    )

    db.refresh(subscription)
    assert subscription.status == "PENDING"
    assert db.query(Payment).count() == 0


def test_out_of_order_payment_event_cannot_overwrite_newer_approved_payment(
    db,
    monkeypatch,
):
    user = make_user(db, "out-of-order@agro.test")
    subscription = make_subscription(db, user)
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_subscription",
        lambda subscription_id: {
            "id": subscription_id,
            "status": "authorized",
            "external_reference": subscription.external_reference,
        },
    )
    newer_approved = {
        "id": "mp-payment-newer",
        "preapproval_id": "mp-sub-1",
        "external_reference": subscription.external_reference,
        "transaction_amount": 8.99,
        "currency_id": "BRL",
        "status": "approved",
        "date_created": "2026-10-04T12:00:00Z",
        "date_approved": "2026-10-04T12:00:00Z",
        "date_last_updated": "2026-10-04T12:01:00Z",
    }
    older_rejected = {
        **newer_approved,
        "id": "mp-payment-older",
        "status": "rejected",
        "date_created": "2026-10-03T12:00:00Z",
        "date_approved": None,
        "date_last_updated": "2026-10-03T12:01:00Z",
    }

    subscription_routes._store_payment(db, newer_approved)
    subscription_routes._store_payment(db, older_rejected)

    db.refresh(subscription)
    assert subscription.status == "ACTIVE"


def test_stale_payment_update_does_not_replace_newer_provider_state(
    db,
    monkeypatch,
):
    user = make_user(db, "stale-update@agro.test")
    subscription = make_subscription(db, user)
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_subscription",
        lambda subscription_id: {
            "id": subscription_id,
            "status": "authorized",
            "external_reference": subscription.external_reference,
        },
    )
    payment = {
        "id": "mp-payment-versioned",
        "preapproval_id": "mp-sub-1",
        "external_reference": subscription.external_reference,
        "transaction_amount": 8.99,
        "currency_id": "BRL",
        "status": "approved",
        "date_created": "2026-10-03T12:00:00Z",
        "date_approved": "2026-10-03T12:00:00Z",
        "date_last_updated": "2026-10-03T12:02:00Z",
    }
    stale_pending = {
        **payment,
        "status": "pending",
        "date_approved": None,
        "date_last_updated": "2026-10-03T12:01:00Z",
    }

    subscription_routes._store_payment(db, payment)
    subscription_routes._store_payment(db, stale_pending)

    assert db.query(Payment).one().status == "approved"
    db.refresh(subscription)
    assert subscription.status == "ACTIVE"


def test_old_approved_payment_does_not_reactivate_subscription(db):
    user = make_user(db, "reactivate@agro.test")
    subscription = make_subscription(db, user, "PENDING")
    subscription.reactivated_at = datetime(2026, 10, 4, 12, tzinfo=timezone.utc)
    payment = Payment(
        subscription_id=subscription.id,
        mercado_pago_payment_id="mp-payment-before-reactivation",
        amount=Decimal("8.99"),
        currency="BRL",
        status="approved",
        payment_date=datetime(2026, 10, 3, 12, tzinfo=timezone.utc),
        provider_updated_at=datetime(2026, 10, 3, 12, 1, tzinfo=timezone.utc),
    )
    db.add(payment)
    db.commit()

    subscription_routes._sync_subscription_snapshot(
        db,
        subscription,
        {
            "id": subscription.mercado_pago_subscription_id,
            "status": "authorized",
            "external_reference": subscription.external_reference,
        },
    )

    assert subscription.status == "PENDING"


def test_failed_provider_compensation_keeps_subscription_for_reconciliation(
    db,
    monkeypatch,
):
    user = make_user(db, "compensation@agro.test")
    subscription = make_subscription(db, user)

    def fail_update(*_args, **_kwargs):
        raise subscription_routes.MercadoPagoServiceError("provider unavailable")

    monkeypatch.setattr(subscription_routes.mp_service, "update_subscription", fail_update)

    subscription_routes._cleanup_failed_subscription(
        db,
        subscription.id,
        "mp-sub-created",
    )

    retained = db.query(Subscription).filter(Subscription.id == subscription.id).one()
    assert retained.mercado_pago_subscription_id == "mp-sub-created"
    assert retained.status == "PENDING"


def make_webhook_request(resource_id: str, signature: str):
    from starlette.requests import Request

    payload = {"type": "payment", "data": {"id": resource_id}}
    body = json.dumps(payload).encode()
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/subscriptions/webhook",
        "query_string": f"type=payment&data.id={resource_id}".encode(),
        "headers": [
            (b"x-signature", signature.encode()),
            (b"x-request-id", b"request-123"),
        ],
    }

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(scope, receive)


def make_signature(resource_id: str, secret: str) -> str:
    timestamp = "1700000000"
    manifest = f"id:{resource_id.lower()};request-id:request-123;ts:{timestamp};"
    digest = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return f"ts={timestamp},v1={digest}"


def test_invalid_webhook_does_not_query_provider_or_write_payment(db, monkeypatch):
    user = make_user(db, "bad-hook@agro.test")
    make_subscription(db, user)
    monkeypatch.setenv("MP_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_payment",
        lambda _: pytest.fail("Provider must not be queried for an invalid signature"),
    )

    request = make_webhook_request("mp-payment-1", "ts=1,v1=invalid")
    with pytest.raises(HTTPException) as error:
        asyncio.run(subscription_routes.subscription_webhook(request, db))

    assert error.value.status_code == 401
    assert db.query(Payment).count() == 0


def test_valid_webhook_processes_authoritative_payment_idempotently(db, monkeypatch):
    user = make_user(db, "valid-hook@agro.test")
    subscription = make_subscription(db, user)
    secret = "test-secret"
    monkeypatch.setenv("MP_WEBHOOK_SECRET", secret)
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_payment",
        lambda payment_id: {
            "id": payment_id,
            "preapproval_id": "mp-sub-1",
            "external_reference": subscription.external_reference,
            "transaction_amount": 8.99,
            "currency_id": "BRL",
            "status": "approved",
            "date_created": "2026-10-03T12:00:00Z",
            "date_approved": "2026-10-03T12:00:00Z",
        },
    )
    monkeypatch.setattr(
        subscription_routes.mp_service,
        "get_subscription",
        lambda subscription_id: {
            "id": subscription_id,
            "status": "authorized",
            "external_reference": subscription.external_reference,
            "date_created": "2026-10-01T12:00:00Z",
        },
    )

    for _ in range(2):
        request = make_webhook_request(
            "mp-payment-1",
            make_signature("mp-payment-1", secret),
        )
        assert asyncio.run(subscription_routes.subscription_webhook(request, db)) == {
            "received": True
        }

    assert db.query(Payment).count() == 1
    db.refresh(subscription)
    assert subscription.status == "ACTIVE"


def test_premium_dependency_requires_active_subscription(db):
    user = make_user(db, "free@agro.test")

    with pytest.raises(HTTPException) as error:
        subscription_routes.get_current_premium_user(user, db)
    assert error.value.status_code == 402
    assert error.value.detail["error"] == "SUBSCRIPTION_REQUIRED"

    make_subscription(db, user, "ACTIVE")
    assert subscription_routes.get_current_premium_user(user, db) is user
