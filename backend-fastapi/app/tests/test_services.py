"""
tests/test_services.py

Testa o user_service (hash de senha).
Não precisa de banco ou FastAPI.
"""

import pytest
from app.services.user_service import hash_password, verify_password


class TestUserService:

    def test_hash_returns_string(self):
        hashed = hash_password("minha_senha")
        assert isinstance(hashed, str)

    def test_hash_is_not_plaintext(self):
        hashed = hash_password("minha_senha")
        assert hashed != "minha_senha"

    def test_verify_correct_password(self):
        hashed = hash_password("senha123")
        assert verify_password("senha123", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("senha123")
        assert verify_password("errada", hashed) is False

    def test_same_password_different_hashes(self):
        """bcrypt gera salt diferente a cada hash — nunca devem ser iguais."""
        h1 = hash_password("senha123")
        h2 = hash_password("senha123")
        assert h1 != h2

    def test_empty_password(self):
        hashed = hash_password("")
        assert verify_password("", hashed) is True

    def test_long_password_truncated_at_72(self):
        """bcrypt trunca senhas em 72 bytes — senhas muito longas ainda devem funcionar."""
        long_pw = "a" * 100
        hashed  = hash_password(long_pw)
        assert verify_password(long_pw, hashed) is True