from datetime import datetime, timezone
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.orm import relationship

from app.database.database import Base

SUBSCRIPTION_STATUSES = ("PENDING", "ACTIVE", "PAUSED", "CANCELED", "PAST_DUE")
OPEN_SUBSCRIPTION_STATUSES = ("PENDING", "ACTIVE", "PAUSED", "PAST_DUE")


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'ACTIVE', 'PAUSED', 'CANCELED', 'PAST_DUE')",
            name="ck_subscriptions_status",
        ),
        Index(
            "uq_subscriptions_one_open_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status != 'CANCELED'"),
            sqlite_where=text("status != 'CANCELED'"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mercado_pago_subscription_id = Column(String, unique=True, nullable=True, index=True)
    external_reference = Column(String, unique=True, nullable=False, index=True)
    plan = Column(String, nullable=False)
    status = Column(String(16), nullable=False, default="PENDING", index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="BRL")
    start_date = Column(DateTime(timezone=True), nullable=True)
    next_payment_date = Column(DateTime(timezone=True), nullable=True)
    canceled_at = Column(DateTime(timezone=True), nullable=True)
    reactivated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="subscriptions")
    payments = relationship(
        "Payment",
        back_populates="subscription",
        cascade="all,delete-orphan",
    )
