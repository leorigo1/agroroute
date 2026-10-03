import pytest
from fastapi import HTTPException
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import auth_routes
from app.database.database import Base
from app.models.field_model import Field
from app.models.routes_model import Route
from app.models.subscription_model import Subscription
from app.models.user_model import User


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine, tables=[User.__table__])
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine, tables=[User.__table__])
        engine.dispose()


def test_google_credential_verification_checks_configured_audience(monkeypatch):
    monkeypatch.setattr(auth_routes, "GOOGLE_CLIENT_ID", "google-client-id")
    received = {}

    def verify(credential, request, audience):
        received.update(credential=credential, audience=audience)
        return {
            "iss": "https://accounts.google.com",
            "email": "person@example.test",
            "email_verified": True,
            "sub": "google-user-id",
        }

    monkeypatch.setattr(auth_routes.id_token, "verify_oauth2_token", verify)

    claims = auth_routes._verify_google_credential("signed-google-id-token")

    assert claims["email"] == "person@example.test"
    assert received == {
        "credential": "signed-google-id-token",
        "audience": "google-client-id",
    }


def test_google_credential_reports_client_id_audience_mismatch(monkeypatch):
    monkeypatch.setattr(auth_routes, "GOOGLE_CLIENT_ID", "backend-client-id")
    monkeypatch.setattr(
        auth_routes.id_token,
        "verify_oauth2_token",
        lambda *args, **kwargs: pytest.fail(
            "Não deve validar token com audience já incompatível."
        ),
    )
    credential = jwt.encode(
        {
            "aud": "different-frontend-client-id",
            "exp": 1_900_000_000,
        },
        "untrusted-test-signing-key",
        algorithm="HS256",
    )

    with pytest.raises(HTTPException) as error:
        auth_routes._verify_google_credential(credential)

    assert error.value.status_code == 401
    assert "Client ID configurado no backend" in error.value.detail


@pytest.mark.parametrize(
    "claims",
    [
        {
            "iss": "https://accounts.google.com",
            "email": "person@example.test",
            "email_verified": False,
            "sub": "google-user-id",
        },
        {
            "iss": "https://attacker.example",
            "email": "person@example.test",
            "email_verified": True,
            "sub": "google-user-id",
        },
        {
            "iss": "https://accounts.google.com",
            "email": "person@example.test",
            "email_verified": True,
        },
    ],
)
def test_google_credential_rejects_unverified_or_invalid_claims(monkeypatch, claims):
    monkeypatch.setattr(auth_routes, "GOOGLE_CLIENT_ID", "google-client-id")
    monkeypatch.setattr(
        auth_routes.id_token,
        "verify_oauth2_token",
        lambda *args, **kwargs: claims,
    )

    with pytest.raises(HTTPException) as error:
        auth_routes._verify_google_credential("id-token")

    assert error.value.status_code == 401


def test_google_login_creates_account_and_returns_existing_jwt_shape(db, monkeypatch):
    claims = {
        "iss": "https://accounts.google.com",
        "email": " NEW.USER@EXAMPLE.TEST ",
        "email_verified": True,
        "sub": "google-user-id",
    }
    monkeypatch.setattr(
        auth_routes,
        "_verify_google_credential",
        lambda credential: claims,
    )

    response = auth_routes.google_login(
        auth_routes.GoogleLoginRequest(credential="google-id-token"),
        db,
    )

    user = db.query(User).one()
    decoded = jwt.decode(
        response["access_token"],
        auth_routes.SECRET_KEY,
        algorithms=[auth_routes.ALGORITHM],
    )
    assert user.email == "new.user@example.test"
    assert user.password != "google-id-token"
    assert response["token_type"] == "bearer"
    assert int(decoded["sub"]) == user.id


def test_google_login_uses_existing_account_for_verified_email(db, monkeypatch):
    existing = User(email="existing@example.test", password="local-password-hash")
    db.add(existing)
    db.commit()
    monkeypatch.setattr(
        auth_routes,
        "_verify_google_credential",
        lambda credential: {
            "iss": "accounts.google.com",
            "email": "EXISTING@example.test",
            "email_verified": True,
            "sub": "google-user-id",
        },
    )

    response = auth_routes.google_login(
        auth_routes.GoogleLoginRequest(credential="google-id-token"),
        db,
    )

    assert db.query(User).count() == 1
    assert db.query(User).one().password == "local-password-hash"
    assert jwt.decode(
        response["access_token"],
        auth_routes.SECRET_KEY,
        algorithms=[auth_routes.ALGORITHM],
    )["sub"] == str(existing.id)
