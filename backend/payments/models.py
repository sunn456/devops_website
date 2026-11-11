"""Модуль payments: платежі та повернення коштів.

Дані банківської картки в системі не зберігаються (вимога 5.3) —
лише ідентифікатор операції у платіжному сервісі.
"""
from django.db import models

from catalog.models import MONEY


class Payment(models.Model):
    class Kind(models.TextChoices):
        PAYMENT = "payment", "Оплата бронювання"
        SURCHARGE = "surcharge", "Доплата за зміну"

    class Status(models.TextChoices):
        PENDING = "pending", "Очікує"
        SUCCEEDED = "succeeded", "Проведено"
        FAILED = "failed", "Не проведено"

    booking = models.ForeignKey("bookings.Booking", on_delete=models.PROTECT, related_name="payments")
    change_request = models.ForeignKey(
        "bookings.ChangeRequest", on_delete=models.PROTECT, related_name="payments", null=True, blank=True
    )
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.PAYMENT)
    amount = models.DecimalField("Сума, грн", **MONEY)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    provider_ref = models.CharField("Ідентифікатор у платіжному сервісі", max_length=64, unique=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Платіж"
        verbose_name_plural = "Платежі"

    def __str__(self):
        return f"{self.get_kind_display()} {self.amount} грн ({self.get_status_display()})"


class Refund(models.Model):
    class Reason(models.TextChoices):
        CANCELLATION = "cancellation", "Скасування бронювання"
        CHANGE = "change", "Різниця при зміні"
        LATE_PAYMENT = "late_payment", "Запізніла оплата без вільних місць"
        DUPLICATE = "duplicate", "Повторна оплата"

    class Status(models.TextChoices):
        PENDING = "pending", "Виконується"
        SUCCEEDED = "succeeded", "Повернено"
        FAILED = "failed", "Помилка (опрацьовує адміністратор)"

    booking = models.ForeignKey("bookings.Booking", on_delete=models.PROTECT, related_name="refunds")
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="refunds")
    amount = models.DecimalField("Сума, грн", **MONEY)
    reason = models.CharField(max_length=15, choices=Reason.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    provider_ref = models.CharField(max_length=64, blank=True)
    error_message = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Повернення коштів"
        verbose_name_plural = "Повернення коштів"
