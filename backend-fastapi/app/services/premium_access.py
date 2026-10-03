from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.premium_trial_usage_model import PremiumTrialUsage
from app.models.subscription_model import Subscription

SUBSCRIPTION_REQUIRED = {
    "error": "SUBSCRIPTION_REQUIRED",
    "message": "É necessário possuir uma assinatura ativa.",
}


def _utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_active_subscription(db: Session, user_id: int) -> Subscription | None:
    return next(
        (
            subscription
            for subscription in get_active_subscriptions(db, user_id)
            if _is_effective(subscription)
        ),
        None,
    )


def get_active_subscriptions(db: Session, user_id: int) -> list[Subscription]:
    return (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.status == "ACTIVE",
        )
        .order_by(Subscription.updated_at.desc(), Subscription.id.desc())
        .all()
    )


def _is_effective(subscription: Subscription) -> bool:
    if subscription.mercado_pago_subscription_id is not None:
        return True
    expires_at = _utc_datetime(subscription.next_payment_date)
    return expires_at is not None and expires_at > datetime.now(timezone.utc)


def get_premium_access_state(db: Session, user_id: int) -> dict[str, bool]:
    is_premium = get_active_subscription(db, user_id) is not None
    trial_used = (
        db.query(PremiumTrialUsage.id)
        .filter(PremiumTrialUsage.user_id == user_id)
        .first()
        is not None
    )
    return {
        "premium": is_premium,
        "free_usage_available": not is_premium and not trial_used,
        "free_usage_used": trial_used,
    }


def reserve_free_premium_usage(db: Session, user_id: int) -> bool:
    if get_active_subscription(db, user_id) is not None:
        return False

    dialect = db.get_bind().dialect.name
    values = {
        "user_id": user_id,
        "used_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
    }
    if dialect == "postgresql":
        statement = postgresql_insert(PremiumTrialUsage).values(**values)
        statement = statement.on_conflict_do_nothing(
            index_elements=[PremiumTrialUsage.user_id]
        )
    elif dialect == "sqlite":
        statement = sqlite_insert(PremiumTrialUsage).values(**values)
        statement = statement.on_conflict_do_nothing(
            index_elements=[PremiumTrialUsage.user_id]
        )
    else:
        raise RuntimeError(
            "O banco atual não oferece inserção atômica para o uso gratuito Premium."
        )

    result = db.execute(statement)
    if result.rowcount != 1:
        raise HTTPException(status_code=402, detail=SUBSCRIPTION_REQUIRED)
    return True
