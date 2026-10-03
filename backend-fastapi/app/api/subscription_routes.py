import hashlib
import hmac
import logging
import os
import re
import uuid
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import desc
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.payment_model import Payment
from app.models.subscription_model import (
    OPEN_SUBSCRIPTION_STATUSES,
    Subscription,
)
from app.models.user_model import User
from app.services import mercadopago_service as mp_service
from app.services.mercadopago_service import (
    MercadoPagoConfigurationError,
    MercadoPagoError,
    MercadoPagoServiceError,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey123")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
PLAN_NAME = "PREMIUM_MONTHLY"
SUBSCRIPTION_REQUIRED = {
    "error": "SUBSCRIPTION_REQUIRED",
    "message": "É necessário possuir uma assinatura ativa.",
}


class CreateSubscriptionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    card_token_id: str = Field(min_length=1, max_length=256)

    @field_validator("card_token_id")
    @classmethod
    def validate_card_token_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("card_token_id não pode estar vazio.")
        return value


class CreatePixPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cpf: str = Field(min_length=11, max_length=14)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if len(digits) != 11:
            raise ValueError("Informe um CPF válido com 11 dígitos.")
        return digits


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        ) from error

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


def get_current_premium_user(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    subscription = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status == "ACTIVE",
        )
        .order_by(desc(Subscription.updated_at), desc(Subscription.id))
        .first()
    )
    next_payment_date = (
        _as_datetime(subscription.next_payment_date)
        if subscription is not None
        else None
    )
    if (
        subscription is not None
        and subscription.mercado_pago_subscription_id is None
        and next_payment_date is not None
        and next_payment_date <= datetime.now(timezone.utc)
    ):
        subscription.status = "PAST_DUE"
        db.commit()
    if subscription is None or subscription.status != "ACTIVE":
        raise HTTPException(
            status_code=402,
            detail=SUBSCRIPTION_REQUIRED,
        )
    return user


def _as_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise MercadoPagoServiceError(
                "Mercado Pago retornou uma data inválida."
            ) from error
    else:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _as_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise MercadoPagoServiceError("Mercado Pago retornou um valor inválido.")


def _subscription_response(subscription: Subscription | None) -> dict[str, Any] | None:
    if subscription is None:
        return None
    return {
        "id": subscription.id,
        "status": subscription.status,
        "plan": subscription.plan,
        "payment_method": (
            "pix" if subscription.mercado_pago_subscription_id is None else "card"
        ),
        "amount": float(subscription.amount),
        "currency": subscription.currency,
        "start_date": subscription.start_date,
        "next_payment_date": subscription.next_payment_date,
        "canceled_at": subscription.canceled_at,
    }


def _get_frontend_url() -> str:
    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if not frontend_url:
        raise MercadoPagoConfigurationError("FRONTEND_URL não configurado.")
    return frontend_url


def _provider_subscription_for(
    local_subscription: Subscription,
) -> dict[str, Any]:
    if not local_subscription.mercado_pago_subscription_id:
        raise MercadoPagoServiceError(
            "A assinatura local ainda não possui ID do Mercado Pago."
        )
    remote = mp_service.get_subscription(
        local_subscription.mercado_pago_subscription_id
    )
    if (
        str(remote.get("id")) != local_subscription.mercado_pago_subscription_id
        or remote.get("external_reference") != local_subscription.external_reference
    ):
        raise MercadoPagoServiceError(
            "A assinatura consultada não corresponde ao registro local."
        )
    return remote


def _latest_payment(db: Session, subscription_id: int) -> Payment | None:
    return (
        db.query(Payment)
        .filter(Payment.subscription_id == subscription_id)
        .order_by(desc(Payment.payment_date), desc(Payment.id))
        .first()
    )


def _add_one_month(value: datetime) -> datetime:
    month = value.month % 12 + 1
    year = value.year + (value.month // 12)
    return value.replace(
        year=year,
        month=month,
        day=min(value.day, monthrange(year, month)[1]),
    )


def _sync_pix_entitlement(db: Session, subscription: Subscription) -> None:
    if subscription.mercado_pago_subscription_id is not None:
        return

    approved_payments = (
        db.query(Payment)
        .filter(
            Payment.subscription_id == subscription.id,
            Payment.status == "approved",
        )
        .order_by(Payment.payment_date, Payment.id)
        .all()
    )
    period_end: datetime | None = None
    first_payment_date: datetime | None = None
    for payment in approved_payments:
        payment_date = _as_datetime(payment.payment_date)
        if payment_date is None:
            continue
        if first_payment_date is None:
            first_payment_date = payment_date
        period_end = _add_one_month(max(payment_date, period_end or payment_date))

    subscription.start_date = first_payment_date
    subscription.next_payment_date = period_end
    if period_end is None:
        if subscription.status not in {"CANCELED", "PAUSED"}:
            failed_payment_exists = (
                db.query(Payment)
                .filter(
                    Payment.subscription_id == subscription.id,
                    Payment.status.in_(
                        {"rejected", "cancelled", "refunded", "charged_back"}
                    ),
                )
                .first()
                is not None
            )
            subscription.status = (
                "PAST_DUE" if failed_payment_exists else "PENDING"
            )
        return

    if subscription.status not in {"CANCELED", "PAUSED"}:
        subscription.status = (
            "ACTIVE" if period_end > datetime.now(timezone.utc) else "PAST_DUE"
        )


def _save_payment(
    db: Session,
    subscription: Subscription,
    payment_data: dict[str, Any],
) -> None:
    payment_id = payment_data.get("id")
    amount = _as_decimal(payment_data.get("transaction_amount"))
    currency = str(payment_data.get("currency_id") or "")
    if amount != Decimal(subscription.amount) or currency != subscription.currency:
        logger.warning(
            "Pagamento %s ignorado por valor ou moeda diferente do plano.",
            payment_id,
        )
        return

    payment_date = _as_datetime(
        payment_data.get("date_approved") or payment_data.get("date_created")
    )
    provider_updated_at = _as_datetime(
        payment_data.get("date_last_updated")
        or payment_data.get("date_approved")
        or payment_data.get("date_created")
    )
    if provider_updated_at is None:
        raise MercadoPagoServiceError("Pagamento Mercado Pago sem data de atualização.")
    payment_status = str(payment_data.get("status", "")).lower()
    if not payment_status:
        raise MercadoPagoServiceError("Pagamento Mercado Pago sem status.")

    payment_values = {
        "subscription_id": subscription.id,
        "mercado_pago_payment_id": str(payment_id),
        "amount": amount,
        "currency": currency,
        "status": payment_status,
        "payment_date": payment_date,
        "provider_updated_at": provider_updated_at,
        "updated_at": datetime.now(timezone.utc),
    }
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        statement = postgresql_insert(Payment).values(**payment_values)
        statement = statement.on_conflict_do_update(
            index_elements=[Payment.mercado_pago_payment_id],
            set_={
                "subscription_id": statement.excluded.subscription_id,
                "amount": statement.excluded.amount,
                "currency": statement.excluded.currency,
                "status": statement.excluded.status,
                "payment_date": statement.excluded.payment_date,
                "provider_updated_at": statement.excluded.provider_updated_at,
                "updated_at": statement.excluded.updated_at,
            },
            where=(
                Payment.provider_updated_at.is_(None)
                | (
                    statement.excluded.provider_updated_at
                    >= Payment.provider_updated_at
                )
            ),
        )
    elif dialect == "sqlite":
        statement = sqlite_insert(Payment).values(**payment_values)
        statement = statement.on_conflict_do_update(
            index_elements=[Payment.mercado_pago_payment_id],
            set_={
                "subscription_id": statement.excluded.subscription_id,
                "amount": statement.excluded.amount,
                "currency": statement.excluded.currency,
                "status": statement.excluded.status,
                "payment_date": statement.excluded.payment_date,
                "provider_updated_at": statement.excluded.provider_updated_at,
                "updated_at": statement.excluded.updated_at,
            },
            where=(
                Payment.provider_updated_at.is_(None)
                | (
                    statement.excluded.provider_updated_at
                    >= Payment.provider_updated_at
                )
            ),
        )
    else:
        raise MercadoPagoServiceError(
            "O banco atual não possui suporte ao upsert idempotente requerido."
        )
    db.execute(statement)
    db.flush()


def _sync_subscription_snapshot(
    db: Session,
    local_subscription: Subscription,
    remote: dict[str, Any],
) -> None:
    remote_status = str(remote.get("status", "")).lower()
    if remote_status == "cancelled":
        local_subscription.status = "CANCELED"
        local_subscription.canceled_at = (
            _as_datetime(remote.get("date_cancelled")) or datetime.now(timezone.utc)
        )
    elif remote_status == "paused":
        local_subscription.status = "PAUSED"
    elif remote_status == "authorized":
        latest_payment = _latest_payment(db, local_subscription.id)
        payment_date = (
            _as_datetime(latest_payment.payment_date)
            if latest_payment is not None
            else None
        )
        reactivated_at = _as_datetime(local_subscription.reactivated_at)
        if (
            latest_payment is not None
            and latest_payment.status == "approved"
            and (
                reactivated_at is None
                or (payment_date is not None and payment_date >= reactivated_at)
            )
        ):
            local_subscription.status = "ACTIVE"
        elif latest_payment is not None and latest_payment.status in {
            "rejected",
            "cancelled",
            "refunded",
            "charged_back",
        }:
            local_subscription.status = "PAST_DUE"
        elif local_subscription.status not in {"ACTIVE", "PAST_DUE"}:
            local_subscription.status = "PENDING"
    elif remote_status == "pending":
        if local_subscription.status not in {"ACTIVE", "PAST_DUE"}:
            local_subscription.status = "PENDING"
    elif remote_status == "rejected":
        local_subscription.status = "PAST_DUE"

    local_subscription.start_date = (
        _as_datetime(remote.get("date_created")) or local_subscription.start_date
    )
    local_subscription.next_payment_date = _as_datetime(
        remote.get("next_payment_date")
    )


def _store_payment(db: Session, payment_data: dict[str, Any]) -> Subscription | None:
    payment_id = payment_data.get("id")
    provider_subscription_id = payment_data.get("preapproval_id")
    external_reference = payment_data.get("external_reference")
    if not payment_id:
        logger.warning("Notificação de pagamento sem ID.")
        return None

    if provider_subscription_id:
        local_subscription = (
            db.query(Subscription)
            .filter(
                Subscription.mercado_pago_subscription_id
                == str(provider_subscription_id)
            )
            .first()
        )
    elif external_reference:
        local_subscription = (
            db.query(Subscription)
            .filter(Subscription.external_reference == str(external_reference))
            .first()
        )
    else:
        logger.warning("Notificação de pagamento sem vínculo de assinatura.")
        return None

    if local_subscription is None:
        logger.warning(
            "Pagamento Mercado Pago %s não corresponde a uma assinatura local.",
            payment_id,
        )
        return None
    is_pix_payment = not provider_subscription_id
    if is_pix_payment:
        if (
            local_subscription.mercado_pago_subscription_id is not None
            or str(payment_data.get("payment_method_id", "")).lower() != "pix"
            or external_reference != local_subscription.external_reference
        ):
            logger.warning("Pagamento PIX não corresponde a uma assinatura PIX local.")
            return None
        remote_subscription = None
    else:
        remote_subscription = mp_service.get_subscription(
            str(provider_subscription_id)
        )
        if (
            str(remote_subscription.get("id")) != str(provider_subscription_id)
            or remote_subscription.get("external_reference")
            != local_subscription.external_reference
        ):
            logger.warning("Assinatura remota não corresponde ao pagamento recebido.")
            return None

    local_subscription = (
        db.query(Subscription)
        .filter(Subscription.id == local_subscription.id)
        .with_for_update()
        .first()
    )
    if local_subscription is None:
        return None
    if provider_subscription_id:
        remote_subscription = _provider_subscription_for(local_subscription)
    elif (
        local_subscription.mercado_pago_subscription_id is not None
        or external_reference != local_subscription.external_reference
    ):
        logger.warning("Referência externa do pagamento não corresponde à assinatura.")
        return None

    _save_payment(db, local_subscription, payment_data)
    db.expire_all()
    if is_pix_payment:
        _sync_pix_entitlement(db, local_subscription)
    else:
        _sync_subscription_snapshot(db, local_subscription, remote_subscription)
        latest_payment = _latest_payment(db, local_subscription.id)
        if (
            latest_payment is not None
            and latest_payment.status == "approved"
            and remote_subscription.get("status") == "authorized"
            and local_subscription.status not in {"PAUSED", "CANCELED"}
        ):
            local_subscription.status = "ACTIVE"
        elif latest_payment is not None and latest_payment.status in {
            "rejected",
            "cancelled",
            "refunded",
            "charged_back",
        } and local_subscription.status not in {"PAUSED", "CANCELED"}:
            local_subscription.status = "PAST_DUE"

    db.commit()
    db.refresh(local_subscription)
    return local_subscription


def _webhook_signature_is_valid(
    *,
    secret: str,
    signature_header: str | None,
    request_id: str | None,
    resource_id: str,
) -> bool:
    if not secret or not signature_header or not resource_id:
        return False

    signature_parts: dict[str, str] = {}
    for part in signature_header.split(","):
        key, separator, value = part.strip().partition("=")
        if separator:
            signature_parts[key] = value
    timestamp = signature_parts.get("ts")
    received_signature = signature_parts.get("v1")
    if not timestamp or not received_signature:
        return False

    manifest = f"id:{resource_id.lower()};"
    if request_id:
        manifest += f"request-id:{request_id};"
    manifest += f"ts:{timestamp};"
    expected_signature = hmac.new(
        secret.encode(),
        manifest.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected_signature, received_signature)


def _notification_resource_id(
    request: Request,
    payload: dict[str, Any],
) -> str | None:
    query_id = request.query_params.get("data.id")
    body_data = payload.get("data")
    body_id = body_data.get("id") if isinstance(body_data, dict) else None
    resource_id = query_id or body_id
    return str(resource_id) if resource_id else None


def _pix_payment_response(payment_data: dict[str, Any]) -> dict[str, Any]:
    interaction = payment_data.get("point_of_interaction")
    transaction_data = (
        interaction.get("transaction_data")
        if isinstance(interaction, dict)
        else None
    )
    if not isinstance(transaction_data, dict):
        raise MercadoPagoServiceError(
            "Mercado Pago não retornou os dados do QR Code PIX."
        )
    qr_code = transaction_data.get("qr_code")
    qr_code_base64 = transaction_data.get("qr_code_base64")
    if not qr_code and not qr_code_base64:
        raise MercadoPagoServiceError(
            "Mercado Pago não retornou o código copia e cola nem a imagem PIX."
        )
    return {
        "payment_id": str(payment_data.get("id")),
        "qr_code": qr_code,
        "qr_code_base64": qr_code_base64,
        "ticket_url": transaction_data.get("ticket_url"),
        "expiration_date": payment_data.get("date_of_expiration"),
    }


def _existing_pix_payment(
    db: Session,
    subscription: Subscription,
) -> dict[str, Any] | None:
    payment = _latest_payment(db, subscription.id)
    if payment is None or payment.status != "pending":
        return None
    remote = mp_service.get_payment(payment.mercado_pago_payment_id)
    _store_payment(db, remote)
    if str(remote.get("status", "")).lower() != "pending":
        return None
    expiration = _as_datetime(remote.get("date_of_expiration"))
    if expiration is not None and expiration <= datetime.now(timezone.utc):
        return None
    return _pix_payment_response(remote)


def _cleanup_failed_subscription(
    db: Session,
    local_subscription_id: int,
    provider_subscription_id: str | None,
) -> None:
    db.rollback()
    if provider_subscription_id:
        try:
            mp_service.update_subscription(
                provider_subscription_id,
                {"status": "cancelled"},
            )
        except (MercadoPagoError, MercadoPagoConfigurationError, MercadoPagoServiceError):
            logger.exception(
                "Não foi possível cancelar a assinatura remota após falha local."
            )
            reservation = (
                db.query(Subscription)
                .filter(Subscription.id == local_subscription_id)
                .first()
            )
            if reservation is not None:
                reservation.mercado_pago_subscription_id = provider_subscription_id
                try:
                    db.commit()
                except SQLAlchemyError:
                    db.rollback()
                    logger.exception(
                        "Não foi possível persistir a assinatura remota para reconciliação."
                    )
            return

    reservation = (
        db.query(Subscription)
        .filter(Subscription.id == local_subscription_id)
        .first()
    )
    if reservation is None:
        return
    db.delete(reservation)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Falha ao remover reserva local de assinatura.")


@router.get("/me")
def get_my_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    subscription = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(desc(Subscription.created_at), desc(Subscription.id))
        .first()
    )
    if (
        subscription is not None
        and subscription.mercado_pago_subscription_id is None
    ):
        latest_payment = _latest_payment(db, subscription.id)
        if latest_payment is not None and latest_payment.status == "pending":
            try:
                remote_payment = mp_service.get_payment(
                    latest_payment.mercado_pago_payment_id
                )
                _store_payment(db, remote_payment)
            except (
                MercadoPagoError,
                MercadoPagoConfigurationError,
                MercadoPagoServiceError,
            ) as error:
                db.rollback()
                logger.error("Falha ao atualizar pagamento PIX: %s", error)
                raise HTTPException(
                    status_code=503
                    if isinstance(error, MercadoPagoConfigurationError)
                    else 502,
                    detail="Não foi possível consultar o pagamento PIX.",
                ) from error
            refreshed_subscription = (
                db.query(Subscription)
                .filter(Subscription.id == subscription.id)
                .first()
            )
            if refreshed_subscription is None:
                return {"subscription": None}
            subscription = refreshed_subscription
        next_payment_date = _as_datetime(subscription.next_payment_date)
        if (
            subscription.status == "ACTIVE"
            and next_payment_date is not None
            and next_payment_date <= datetime.now(timezone.utc)
        ):
            subscription.status = "PAST_DUE"
        db.commit()
    return {"subscription": _subscription_response(subscription)}


@router.post("/pix", status_code=201)
def create_pix_payment(
    payload: CreatePixPaymentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        amount, currency = mp_service.get_monthly_amount()
        frontend_url = _get_frontend_url()
    except MercadoPagoConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    db.query(User).filter(User.id == user.id).with_for_update().first()
    subscription = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(OPEN_SUBSCRIPTION_STATUSES),
        )
        .with_for_update()
        .first()
    )
    if subscription is not None and subscription.mercado_pago_subscription_id:
        raise HTTPException(
            status_code=409,
            detail="Esta conta já possui uma assinatura recorrente por cartão.",
        )

    if subscription is None:
        subscription = Subscription(
            user_id=user.id,
            external_reference=f"agroroute:{user.id}:{uuid.uuid4()}",
            plan=PLAN_NAME,
            status="PENDING",
            amount=Decimal(str(amount)),
            currency=currency,
        )
        db.add(subscription)
        try:
            db.commit()
            db.refresh(subscription)
        except SQLAlchemyError as error:
            db.rollback()
            if isinstance(error, IntegrityError):
                raise HTTPException(
                    status_code=409,
                    detail="Já existe uma assinatura não cancelada para este usuário.",
                ) from error
            raise

    try:
        existing_pix = _existing_pix_payment(db, subscription)
        if existing_pix is not None:
            return {
                "subscription": _subscription_response(subscription),
                "pix": existing_pix,
            }

        payment_count = (
            db.query(Payment)
            .filter(Payment.subscription_id == subscription.id)
            .count()
        )
        expiration = datetime.now(timezone.utc) + timedelta(minutes=30)
        payment_data = mp_service.create_payment(
            {
                "transaction_amount": float(subscription.amount),
                "description": "AgroRoute Premium mensal",
                "payment_method_id": "pix",
                "external_reference": subscription.external_reference,
                "notification_url": f"{frontend_url}/api/subscriptions/webhook",
                "date_of_expiration": expiration.isoformat(),
                "payer": {
                    "email": user.email,
                    "identification": {
                        "type": "CPF",
                        "number": payload.cpf,
                    },
                },
            },
            idempotency_key=f"agro-pix-{subscription.id}-{payment_count + 1}",
        )
        if (
            not payment_data.get("id")
            or payment_data.get("external_reference") != subscription.external_reference
            or str(payment_data.get("payment_method_id", "")).lower() != "pix"
        ):
            raise MercadoPagoServiceError(
                "A resposta de criação não confirmou o pagamento PIX esperado."
            )
        _store_payment(db, payment_data)
        subscription = (
            db.query(Subscription)
            .filter(Subscription.id == subscription.id)
            .first()
        )
        if subscription is None:
            raise MercadoPagoServiceError(
                "A assinatura PIX local não foi encontrada após a cobrança."
            )
        return {
            "subscription": _subscription_response(subscription),
            "pix": _pix_payment_response(payment_data),
        }
    except (MercadoPagoError, MercadoPagoConfigurationError, MercadoPagoServiceError) as error:
        db.rollback()
        logger.error("Falha ao criar pagamento PIX no Mercado Pago: %s", error)
        raise HTTPException(
            status_code=503
            if isinstance(error, MercadoPagoConfigurationError)
            else 502,
            detail="Não foi possível gerar o pagamento PIX.",
        ) from error
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Falha ao salvar pagamento PIX.")
        raise


@router.post("", status_code=201)
def create_subscription(
    payload: CreateSubscriptionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        amount, currency = mp_service.get_monthly_amount()
        frontend_url = _get_frontend_url()
    except MercadoPagoConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    db.query(User).filter(User.id == user.id).with_for_update().first()
    existing = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(OPEN_SUBSCRIPTION_STATUSES),
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Já existe uma assinatura não cancelada para este usuário.",
        )

    external_reference = f"agroroute:{user.id}:{uuid.uuid4()}"
    subscription = Subscription(
        user_id=user.id,
        external_reference=external_reference,
        plan=PLAN_NAME,
        status="PENDING",
        amount=Decimal(str(amount)),
        currency=currency,
    )
    db.add(subscription)
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        if isinstance(error, IntegrityError):
            raise HTTPException(
                status_code=409,
                detail="Já existe uma assinatura não cancelada para este usuário.",
            ) from error
        raise
    db.refresh(subscription)

    request_data = {
        "reason": "AgroRoute Premium mensal",
        "external_reference": external_reference,
        "payer_email": user.email,
        "card_token_id": payload.card_token_id,
        "back_url": f"{frontend_url}/subscription",
        "notification_url": f"{frontend_url}/api/subscriptions/webhook",
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": amount,
            "currency_id": currency,
        },
    }
    local_subscription_id = subscription.id
    provider_subscription_id: str | None = None
    try:
        remote = mp_service.create_subscription(request_data)
        provider_id = remote.get("id")
        if provider_id:
            provider_subscription_id = str(provider_id)
        if not provider_id or remote.get("external_reference") != external_reference:
            raise MercadoPagoServiceError(
                "A resposta de criação não confirmou a assinatura esperada."
            )
        subscription.mercado_pago_subscription_id = provider_subscription_id
        _sync_subscription_snapshot(db, subscription, remote)
        if subscription.status == "ACTIVE":
            subscription.status = "PENDING"
        db.commit()
        db.refresh(subscription)
    except (MercadoPagoError, MercadoPagoConfigurationError, MercadoPagoServiceError) as error:
        _cleanup_failed_subscription(
            db,
            local_subscription_id,
            provider_subscription_id,
        )
        logger.error("Falha ao criar assinatura no Mercado Pago: %s", error)
        error_status = (
            503 if isinstance(error, MercadoPagoConfigurationError) else 502
        )
        raise HTTPException(
            status_code=error_status,
            detail="Não foi possível criar a assinatura.",
        ) from error
    except SQLAlchemyError:
        _cleanup_failed_subscription(
            db,
            local_subscription_id,
            provider_subscription_id,
        )
        raise

    return {"subscription": _subscription_response(subscription)}


def _find_user_open_subscription(db: Session, user_id: int) -> Subscription:
    subscription = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.status.in_(OPEN_SUBSCRIPTION_STATUSES),
        )
        .order_by(desc(Subscription.created_at), desc(Subscription.id))
        .with_for_update()
        .first()
    )
    if subscription is None:
        raise HTTPException(status_code=404, detail="Assinatura não encontrada.")
    return subscription


def _change_subscription_status(
    db: Session,
    user: User,
    action: str,
):
    subscription = _find_user_open_subscription(db, user.id)
    if subscription.mercado_pago_subscription_id is None:
        raise HTTPException(
            status_code=409,
            detail="O plano PIX não tem cobrança automática para pausar ou reativar.",
        )
    try:
        remote = _provider_subscription_for(subscription)
        remote_status = str(remote.get("status", "")).lower()
        if action == "cancel" and remote_status != "cancelled":
            mp_service.update_subscription(
                subscription.mercado_pago_subscription_id,
                {"status": "cancelled"},
            )
        elif action == "pause" and remote_status == "cancelled":
            raise HTTPException(
                status_code=409,
                detail="Uma assinatura cancelada não pode ser pausada.",
            )
        elif action == "pause" and remote_status != "paused":
            if remote_status != "authorized":
                raise HTTPException(
                    status_code=409,
                    detail="A assinatura não pode ser pausada no estado atual.",
                )
            mp_service.update_subscription(
                subscription.mercado_pago_subscription_id,
                {"status": "paused"},
            )
        elif action == "reactivate":
            if remote_status == "cancelled":
                raise HTTPException(
                    status_code=409,
                    detail="Uma assinatura cancelada não pode ser reativada.",
                )
            if remote_status == "paused":
                mp_service.update_subscription(
                    subscription.mercado_pago_subscription_id,
                    {"status": "authorized"},
                )
            elif remote_status != "authorized":
                raise HTTPException(
                    status_code=409,
                    detail="A assinatura não pode ser reativada no estado atual.",
                )

        confirmed = _provider_subscription_for(subscription)
        expected_status = {
            "cancel": "cancelled",
            "pause": "paused",
            "reactivate": "authorized",
        }[action]
        if str(confirmed.get("status", "")).lower() != expected_status:
            raise MercadoPagoServiceError(
                "O Mercado Pago não confirmou a mudança de estado solicitada."
            )
        _sync_subscription_snapshot(db, subscription, confirmed)
        if action == "reactivate":
            subscription.reactivated_at = datetime.now(timezone.utc)
            subscription.status = "PENDING"
        if action == "cancel":
            subscription.canceled_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(subscription)
    except HTTPException:
        raise
    except (MercadoPagoError, MercadoPagoConfigurationError, MercadoPagoServiceError) as error:
        db.rollback()
        logger.error("Falha ao %s assinatura no Mercado Pago: %s", action, error)
        raise HTTPException(
            status_code=503
            if isinstance(error, MercadoPagoConfigurationError)
            else 502,
            detail="Não foi possível confirmar a operação da assinatura.",
        ) from error
    return {"subscription": _subscription_response(subscription)}


@router.post("/me/cancel")
def cancel_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _change_subscription_status(db, user, "cancel")


@router.post("/me/pause")
def pause_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _change_subscription_status(db, user, "pause")


@router.post("/me/reactivate")
def reactivate_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _change_subscription_status(db, user, "reactivate")


@router.post("/webhook")
async def subscription_webhook(request: Request, db: Session = Depends(get_db)):
    secret = os.getenv("MP_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="MP_WEBHOOK_SECRET não configurado.",
        )

    try:
        payload = await request.json()
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Payload JSON inválido.") from error
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido.")

    resource_id = _notification_resource_id(request, payload)
    if not _webhook_signature_is_valid(
        secret=secret,
        signature_header=request.headers.get("x-signature"),
        request_id=request.headers.get("x-request-id"),
        resource_id=resource_id or "",
    ):
        raise HTTPException(status_code=401, detail="Assinatura do webhook inválida.")

    notification_type = (
        request.query_params.get("type")
        or payload.get("type")
        or request.query_params.get("topic")
        or payload.get("topic")
    )
    if notification_type in {"subscription_preapproval", "preapproval"}:
        try:
            remote = mp_service.get_subscription(resource_id)
            local = (
                db.query(Subscription)
                .filter(
                    Subscription.mercado_pago_subscription_id == str(remote.get("id"))
                )
                .with_for_update()
                .first()
            )
            if local is not None and remote.get("external_reference") == local.external_reference:
                remote = _provider_subscription_for(local)
                _sync_subscription_snapshot(db, local, remote)
                db.commit()
        except (MercadoPagoError, MercadoPagoConfigurationError, MercadoPagoServiceError) as error:
            db.rollback()
            logger.error("Falha ao sincronizar assinatura recebida no webhook: %s", error)
            raise HTTPException(
                status_code=503
                if isinstance(error, MercadoPagoConfigurationError)
                else 502,
                detail="Falha ao consultar Mercado Pago.",
            ) from error
    elif notification_type in {"subscription_authorized_payment", "payment"}:
        try:
            if notification_type == "payment":
                payment_info = mp_service.get_payment(resource_id)
            else:
                authorized_payment = mp_service.get_authorized_payment(resource_id)
                payment_id = authorized_payment.get("payment_id")
                if not payment_id and isinstance(authorized_payment.get("payment"), dict):
                    payment_id = authorized_payment["payment"].get("id")
                if not payment_id:
                    logger.warning(
                        "Pagamento autorizado %s ainda não possui payment_id.",
                        resource_id,
                    )
                    return {"received": True}
                payment_info = mp_service.get_payment(str(payment_id))
            _store_payment(db, payment_info)
        except (MercadoPagoError, MercadoPagoConfigurationError, MercadoPagoServiceError) as error:
            db.rollback()
            logger.error("Falha ao sincronizar pagamento recebido no webhook: %s", error)
            raise HTTPException(
                status_code=503
                if isinstance(error, MercadoPagoConfigurationError)
                else 502,
                detail="Falha ao consultar Mercado Pago.",
            ) from error
    elif notification_type == "chargebacks":
        try:
            chargeback = mp_service.get_chargeback(resource_id)
            payment_id = chargeback.get("payment_id")
            if payment_id:
                payment_info = mp_service.get_payment(str(payment_id))
                payment_info["status"] = "charged_back"
                _store_payment(db, payment_info)
        except (MercadoPagoError, MercadoPagoConfigurationError, MercadoPagoServiceError) as error:
            db.rollback()
            logger.error("Falha ao sincronizar chargeback recebido no webhook: %s", error)
            raise HTTPException(
                status_code=503
                if isinstance(error, MercadoPagoConfigurationError)
                else 502,
                detail="Falha ao consultar Mercado Pago.",
            ) from error
    else:
        logger.info("Webhook Mercado Pago recebido para tipo não processado: %s", notification_type)

    return {"received": True}


@router.get("/premium-test")
def premium_test(user: User = Depends(get_current_premium_user)):
    return {"message": "Acesso Premium autorizado"}


__all__ = [
    "router",
    "get_current_premium_user",
    "_notification_resource_id",
    "_store_payment",
    "_webhook_signature_is_valid",
]
