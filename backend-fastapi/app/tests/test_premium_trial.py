from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from app.api import field_routes, subscription_routes
from app.database.database import Base
from app.models.premium_trial_usage_model import PremiumTrialUsage
from app.models.subscription_model import Subscription
from app.models.user_model import User
from app.services.premium_access import (
    get_premium_access_state,
    reserve_free_premium_usage,
)


@pytest.fixture
def trial_session_factory(tmp_path):
    database_path = tmp_path / "premium-trial.sqlite"
    engine = create_engine(
        f"sqlite:///{database_path}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(
        bind=engine,
        tables=[
            User.__table__,
            Subscription.__table__,
            PremiumTrialUsage.__table__,
        ],
    )
    factory = sessionmaker(bind=engine)
    try:
        yield factory
    finally:
        engine.dispose()


def create_trial_user(session_factory, email: str) -> User:
    with session_factory() as db:
        user = User(email=email, password="hashed-password")
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def test_new_user_has_one_free_usage(trial_session_factory):
    user = create_trial_user(trial_session_factory, "new@agro.test")

    with trial_session_factory() as db:
        assert get_premium_access_state(db, user.id) == {
            "premium": False,
            "free_usage_available": True,
            "free_usage_used": False,
        }
        response = subscription_routes.get_my_subscription(db, user)
        assert response["free_usage_available"] is True
        assert response["free_usage_used"] is False


def test_first_usage_is_persisted_and_second_is_rejected(trial_session_factory):
    user = create_trial_user(trial_session_factory, "first@agro.test")
    with trial_session_factory() as db:
        assert reserve_free_premium_usage(db, user.id) is True
        db.commit()

    with trial_session_factory() as db:
        assert get_premium_access_state(db, user.id)["free_usage_used"] is True
        assert get_premium_access_state(db, user.id)["free_usage_available"] is False
        with pytest.raises(HTTPException) as error:
            reserve_free_premium_usage(db, user.id)
        assert error.value.status_code == 402
        assert error.value.detail["error"] == "SUBSCRIPTION_REQUIRED"


def test_active_subscription_does_not_consume_trial(trial_session_factory):
    user = create_trial_user(trial_session_factory, "active@agro.test")
    with trial_session_factory() as db:
        subscription = Subscription(
            user_id=user.id,
            mercado_pago_subscription_id="mp-active",
            external_reference="trial-test-active",
            plan="PREMIUM_MONTHLY",
            status="ACTIVE",
            amount=8.99,
            currency="BRL",
        )
        db.add(subscription)
        db.commit()

    with trial_session_factory() as db:
        assert reserve_free_premium_usage(db, user.id) is False
        assert get_premium_access_state(db, user.id) == {
            "premium": True,
            "free_usage_available": False,
            "free_usage_used": False,
        }


@pytest.mark.parametrize("status", ["CANCELED", "PAUSED"])
def test_subscription_status_change_does_not_restore_used_trial(
    trial_session_factory,
    status,
):
    user = create_trial_user(trial_session_factory, f"{status.lower()}@agro.test")
    with trial_session_factory() as db:
        reserve_free_premium_usage(db, user.id)
        db.commit()
        db.add(
            Subscription(
                user_id=user.id,
                mercado_pago_subscription_id=f"mp-{status.lower()}",
                external_reference=f"trial-test-{status.lower()}",
                plan="PREMIUM_MONTHLY",
                status=status,
                amount=8.99,
                currency="BRL",
            )
        )
        db.commit()

    with trial_session_factory() as db:
        state_after_status_change = get_premium_access_state(db, user.id)
        assert state_after_status_change["premium"] is False
        assert state_after_status_change["free_usage_used"] is True
        assert state_after_status_change["free_usage_available"] is False


def test_usage_persists_across_new_sessions_and_each_user_has_own_trial(
    trial_session_factory,
):
    owner = create_trial_user(trial_session_factory, "persist@agro.test")
    other = create_trial_user(trial_session_factory, "other@agro.test")
    with trial_session_factory() as db:
        reserve_free_premium_usage(db, owner.id)
        db.commit()

    with trial_session_factory() as db:
        assert get_premium_access_state(db, owner.id)["free_usage_used"] is True
        assert get_premium_access_state(db, other.id)["free_usage_available"] is True


def test_frontend_claim_cannot_reset_backend_usage(trial_session_factory):
    user = create_trial_user(trial_session_factory, "tamper@agro.test")
    with trial_session_factory() as db:
        reserve_free_premium_usage(db, user.id)
        db.commit()

    with trial_session_factory() as db:
        # Access state is derived from the authenticated user's database row only.
        assert get_premium_access_state(db, user.id)["free_usage_available"] is False
        with pytest.raises(HTTPException) as error:
            reserve_free_premium_usage(db, user.id)
        assert error.value.status_code == 402


def test_simultaneous_requests_reserve_only_one_trial(trial_session_factory):
    user = create_trial_user(trial_session_factory, "parallel@agro.test")
    barrier = Barrier(2)

    def reserve():
        with trial_session_factory() as db:
            barrier.wait()
            for attempt in range(3):
                try:
                    reserved = reserve_free_premium_usage(db, user.id)
                    db.commit()
                    return reserved
                except HTTPException as error:
                    db.rollback()
                    if error.status_code == 402:
                        return 402
                    raise
                except OperationalError as error:
                    db.rollback()
                    if "locked" not in str(error).lower() or attempt == 2:
                        raise
            raise AssertionError("O teste não conseguiu concluir a reserva.")

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: reserve(), range(2)))

    assert results.count(True) == 1
    assert results.count(402) == 1
    with trial_session_factory() as db:
        assert db.query(PremiumTrialUsage).filter_by(user_id=user.id).count() == 1


class FakeQuery:
    def __init__(self, model, field):
        self.model = model
        self.field = field

    def filter(self, *args):
        return self

    def first(self):
        if self.model is field_routes.Field:
            return self.field
        return None


class FakeSession:
    def __init__(self, field):
        self.field = field
        self.committed = False
        self.rolled_back = False
        self.added = None

    def query(self, model):
        return FakeQuery(model, self.field)

    def add(self, value):
        self.added = value

    def commit(self):
        self.committed = True

    def refresh(self, value):
        return None

    def rollback(self):
        self.rolled_back = True


class RouteSessionProxy:
    def __init__(self, session, field):
        self.session = session
        self.field = field

    def query(self, model):
        if model is field_routes.Field:
            return FakeQuery(model, self.field)
        return self.session.query(model)

    def __getattr__(self, name):
        return getattr(self.session, name)


def test_calculating_route_is_the_operation_that_reserves_trial(monkeypatch):
    field = SimpleNamespace(
        id=10,
        user_id=7,
        polygon="encoded-polygon",
        working_width=6,
        speed_kmh=8,
        fuel_lph=2.5,
    )
    db = FakeSession(field)
    reservations = []
    monkeypatch.setattr(
        field_routes,
        "reserve_free_premium_usage",
        lambda session, user_id: reservations.append((session, user_id)),
    )
    monkeypatch.setattr(field_routes, "to_shape", lambda polygon: "polygon")
    monkeypatch.setattr(
        field_routes,
        "plan_coverage_route",
        lambda *args, **kwargs: ([[[0, 0], [1, 1]]], 10, 2, 1),
    )

    result = field_routes.calculate_route(
        10,
        db,
        SimpleNamespace(id=7),
    )

    assert result.swaths == [[[0, 0], [1, 1]]]
    assert reservations == [(db, 7)]
    assert db.committed is True
    assert db.rolled_back is False


def test_invalid_field_does_not_reserve_trial(monkeypatch):
    db = FakeSession(None)
    reservations = []
    monkeypatch.setattr(
        field_routes,
        "reserve_free_premium_usage",
        lambda *args: reservations.append(args),
    )

    with pytest.raises(HTTPException) as error:
        field_routes.calculate_route(10, db, SimpleNamespace(id=7))

    assert error.value.status_code == 404
    assert reservations == []
    assert db.rolled_back is False


def raise_calculation_error(*args, **kwargs):
    raise RuntimeError("calculation failed")


@pytest.mark.parametrize(
    "calculation",
    [
        lambda *args, **kwargs: ([], 0, 0, 0),
        raise_calculation_error,
    ],
)
def test_failed_route_calculation_rolls_back_trial_reservation(
    monkeypatch,
    calculation,
):
    field = SimpleNamespace(
        id=10,
        user_id=7,
        polygon="encoded-polygon",
        working_width=6,
        speed_kmh=8,
        fuel_lph=2.5,
    )
    db = FakeSession(field)
    monkeypatch.setattr(field_routes, "reserve_free_premium_usage", lambda *args: True)
    monkeypatch.setattr(field_routes, "to_shape", lambda polygon: "polygon")
    monkeypatch.setattr(field_routes, "plan_coverage_route", calculation)

    with pytest.raises((HTTPException, RuntimeError)):
        field_routes.calculate_route(10, db, SimpleNamespace(id=7))

    assert db.committed is False
    assert db.rolled_back is True


def test_failed_calculation_rolls_back_persisted_trial_reservation(
    trial_session_factory,
    monkeypatch,
):
    user = create_trial_user(trial_session_factory, "rollback@agro.test")
    field = SimpleNamespace(
        id=10,
        user_id=user.id,
        polygon="encoded-polygon",
        working_width=6,
        speed_kmh=8,
        fuel_lph=2.5,
    )
    with trial_session_factory() as db:
        route_session = RouteSessionProxy(db, field)
        monkeypatch.setattr(field_routes, "to_shape", lambda polygon: "polygon")
        monkeypatch.setattr(
            field_routes,
            "plan_coverage_route",
            raise_calculation_error,
        )

        with pytest.raises(RuntimeError, match="calculation failed"):
            field_routes.calculate_route(10, route_session, SimpleNamespace(id=user.id))

        assert db.query(PremiumTrialUsage).filter_by(user_id=user.id).count() == 0
