"""PaymentService: створення платежів, обробка повідомлень платіжного сервісу, повернення коштів."""
import json
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from bookings.exceptions import BookingError, InvalidSignature, InvalidState, NotFound
from bookings.pricing import ZERO, money

from .gateway import PaymentGateway, get_gateway
from .models import Payment, Refund


class PaymentService:
    def __init__(self, gateway: PaymentGateway | None = None):
        self.gateway = gateway or get_gateway()

    def start_payment(self, booking, amount: Decimal, kind=Payment.Kind.PAYMENT, change_request=None):
        payment = Payment.objects.create(
            booking=booking, change_request=change_request, kind=kind, amount=money(amount)
        )
        session = self.gateway.create_checkout(payment)
        payment.provider_ref = session.provider_ref
        payment.save(update_fields=["provider_ref"])
        return payment, session.url

    def handle_webhook(self, body: bytes, signature: str) -> tuple[Payment, bool]:
        """Оновлює статус платежу. Повертає (платіж, чи змінився статус).

        Повторне повідомлення про той самий платіж ігнорується (ідемпотентність).
        """
        if not self.gateway.verify_signature(body, signature):
            raise InvalidSignature("Невірний підпис повідомлення платіжного сервісу.")
        try:
            data = json.loads(body)
            ref, status = data["provider_ref"], data["status"]
        except (ValueError, KeyError):
            raise BookingError("Некоректне повідомлення платіжного сервісу.")
        payment = Payment.objects.select_for_update().filter(provider_ref=ref).first()
        if payment is None:
            raise NotFound("Платіж не знайдено.")
        if payment.status != Payment.Status.PENDING:
            return payment, False
        if status == "succeeded":
            payment.status = Payment.Status.SUCCEEDED
            payment.paid_at = timezone.now()
        else:
            payment.status = Payment.Status.FAILED
        payment.save(update_fields=["status", "paid_at"])
        return payment, True

    @staticmethod
    def net_paid(booking) -> Decimal:
        """Фактично отримана сума: проведені платежі мінус виконані повернення."""
        paid = booking.payments.filter(status=Payment.Status.SUCCEEDED).aggregate(s=Sum("amount"))["s"] or ZERO
        refunded = booking.refunds.filter(status=Refund.Status.SUCCEEDED).aggregate(s=Sum("amount"))["s"] or ZERO
        return money(paid - refunded)

    def refund(self, booking, amount: Decimal, reason: str) -> list[Refund]:
        """Повертає суму, розподіляючи її між проведеними платежами (від найновішого)."""
        remaining = money(amount)
        refunds: list[Refund] = []
        if remaining <= 0:
            return refunds
        payments = booking.payments.filter(status=Payment.Status.SUCCEEDED).order_by("-paid_at", "-pk")
        for payment in payments:
            if remaining <= 0:
                break
            claimed = (
                payment.refunds.filter(status__in=[Refund.Status.SUCCEEDED, Refund.Status.FAILED])
                .aggregate(s=Sum("amount"))["s"]
                or ZERO
            )
            part = min(payment.amount - claimed, remaining)
            if part <= 0:
                continue
            refund = Refund.objects.create(booking=booking, payment=payment, amount=part, reason=reason)
            self._execute(refund)
            refunds.append(refund)
            remaining -= part
        if remaining > 0:
            raise BookingError("Сума повернення перевищує отриману оплату.")
        return refunds

    def retry_refund(self, refund: Refund) -> Refund:
        if refund.status != Refund.Status.FAILED:
            raise InvalidState("Повторити можна лише невдале повернення.")
        self._execute(refund)
        return refund

    def _execute(self, refund: Refund) -> None:
        result = self.gateway.refund(refund.payment.provider_ref, refund.amount)
        refund.status = Refund.Status.SUCCEEDED if result.success else Refund.Status.FAILED
        refund.provider_ref = result.provider_ref
        refund.error_message = result.error
        refund.processed_at = timezone.now()
        refund.save()
