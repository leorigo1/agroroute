import os
from typing import Any
from urllib.parse import quote

import mercadopago
from mercadopago.errors.exceptions import MercadoPagoError


class MercadoPagoConfigurationError(RuntimeError):
    pass


class MercadoPagoServiceError(RuntimeError):
    pass


def _sdk() -> mercadopago.SDK:
    access_token = os.getenv("MP_ACCESS_TOKEN", "").strip()
    if not access_token:
        raise MercadoPagoConfigurationError("MP_ACCESS_TOKEN não configurado.")
    return mercadopago.SDK(access_token)


def _unwrap(result: dict[str, Any]) -> dict[str, Any]:
    response = result.get("response")
    if not isinstance(response, dict):
        raise MercadoPagoServiceError("Resposta inesperada da API Mercado Pago.")
    return response


def _checked(result: dict[str, Any]) -> dict[str, Any]:
    response = result.get("response")
    status_code = result.get("status")
    if not isinstance(status_code, int) or not 200 <= status_code < 300:
        raise MercadoPagoServiceError(
            f"Mercado Pago respondeu com HTTP {status_code}."
        )
    return _unwrap(result)


def create_subscription(payload: dict[str, Any]) -> dict[str, Any]:
    return _checked(_sdk().preapproval().create(payload))


def get_subscription(subscription_id: str) -> dict[str, Any]:
    return _checked(_sdk().preapproval().get(subscription_id))


def update_subscription(
    subscription_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    return _checked(_sdk().preapproval().update(subscription_id, payload))


def get_payment(payment_id: str) -> dict[str, Any]:
    return _checked(_sdk().payment().get(payment_id))


def _get_resource(path: str) -> dict[str, Any]:
    sdk = _sdk()
    result = sdk.http_client.get(
        url=f"https://api.mercadopago.com{path}",
        headers=sdk.request_options.get_headers(),
        timeout=sdk.request_options.connection_timeout,
        maxretries=sdk.request_options.max_retries,
    )
    return _checked(result)


def get_authorized_payment(authorized_payment_id: str) -> dict[str, Any]:
    return _get_resource(
        f"/authorized_payments/{quote(authorized_payment_id, safe='')}"
    )


def get_chargeback(chargeback_id: str) -> dict[str, Any]:
    return _checked(_sdk().chargeback().get(chargeback_id))


def get_monthly_amount() -> tuple[float, str]:
    raw_amount = os.getenv("MP_PREMIUM_MONTHLY_AMOUNT", "8.99").strip()
    try:
        amount = float(raw_amount)
    except ValueError as error:
        raise MercadoPagoConfigurationError(
            "MP_PREMIUM_MONTHLY_AMOUNT deve ser um valor numérico."
        ) from error
    if not 0 < amount < 1_000_000:
        raise MercadoPagoConfigurationError(
            "MP_PREMIUM_MONTHLY_AMOUNT deve ser maior que zero."
        )
    return round(amount, 2), "BRL"


__all__ = [
    "MercadoPagoConfigurationError",
    "MercadoPagoServiceError",
    "MercadoPagoError",
    "create_subscription",
    "get_subscription",
    "update_subscription",
    "get_payment",
    "get_authorized_payment",
    "get_chargeback",
    "get_monthly_amount",
]
