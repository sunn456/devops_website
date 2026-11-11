"""Взаємодія з платіжним сервісом.

PaymentGateway — абстрактний інтерфейс; TestPaymentGateway — реалізація тестового
режиму. Реальний сервіс (наприклад, LiqPay або Stripe) підключається новим класом
і зміною налаштування WINTERRA["PAYMENT_GATEWAY"] без змін бізнес-логіки.
"""
import hashlib
import hmac
import json
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings
from django.utils.module_loading import import_string


@dataclass(frozen=True)
class CheckoutSession:
    provider_ref: str
    url: str


@dataclass(frozen=True)
class GatewayRefundResult:
    success: bool
    provider_ref: str = ""
    error: str = ""


class PaymentGateway(ABC):
    @abstractmethod
    def create_checkout(self, payment) -> CheckoutSession:
        """Створює сесію оплати й повертає посилання на сторінку оплати."""

    @abstractmethod
    def verify_signature(self, body: bytes, signature: str) -> bool:
        """Перевіряє підпис повідомлення про результат оплати."""

    @abstractmethod
    def refund(self, payment_ref: str, amount: Decimal) -> GatewayRefundResult:
        """Повертає кошти за проведеним платежем."""


class TestPaymentGateway(PaymentGateway):
    """Тестовий платіжний сервіс.

    Картка 4000 0000 0000 0002 — відмова; будь-яка інша з 16 цифр — успішна оплата.
    """

    DECLINED_CARD = "4000000000000002"

    def __init__(self, secret: str | None = None, frontend_url: str | None = None, fail_refunds: bool | None = None):
        cfg = settings.WINTERRA
        self.secret = (secret or cfg["PAYMENT_WEBHOOK_SECRET"]).encode()
        self.frontend_url = frontend_url or cfg["FRONTEND_URL"]
        self.fail_refunds = cfg["TEST_GATEWAY_FAIL_REFUNDS"] if fail_refunds is None else fail_refunds

    def create_checkout(self, payment) -> CheckoutSession:
        ref = f"test_{uuid.uuid4().hex[:20]}"
        return CheckoutSession(provider_ref=ref, url=f"{self.frontend_url}/pay/{ref}")

    def sign(self, body: bytes) -> str:
        return hmac.new(self.secret, body, hashlib.sha256).hexdigest()

    def verify_signature(self, body: bytes, signature: str) -> bool:
        return hmac.compare_digest(self.sign(body), signature or "")

    def charge(self, provider_ref: str, card_number: str) -> tuple[bytes, str]:
        """Імітує сторінку оплати: повертає підписане повідомлення про результат."""
        digits = "".join(ch for ch in card_number if ch.isdigit())
        ok = len(digits) == 16 and digits != self.DECLINED_CARD
        body = json.dumps({"provider_ref": provider_ref, "status": "succeeded" if ok else "failed"}).encode()
        return body, self.sign(body)

    def refund(self, payment_ref: str, amount: Decimal) -> GatewayRefundResult:
        if self.fail_refunds:
            return GatewayRefundResult(False, error="Платіжний сервіс відхилив повернення (тестовий режим).")
        return GatewayRefundResult(True, provider_ref=f"rf_{uuid.uuid4().hex[:20]}")


def get_gateway() -> PaymentGateway:
    return import_string(settings.WINTERRA["PAYMENT_GATEWAY"])()
