"""Правила скасування та зміни бронювань (FR-10, FR-11).

Скасування не пізніше ніж за 7 днів до заїзду — повне повернення сплаченої суми,
пізніше — без повернення. Зміна дозволена лише не пізніше ніж за 7 днів до заїзду.
"""
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from .exceptions import InvalidState, PolicyViolation
from .models import Booking
from .pricing import ZERO, money


class BookingPolicy:
    def __init__(self, free_days: int | None = None):
        self.free_days = free_days or settings.WINTERRA["FREE_CHANGE_CANCEL_DAYS"]

    @staticmethod
    def days_before_start(booking: Booking, today: date | None = None) -> int:
        today = today or timezone.localdate()
        return (booking.departure.start_date - today).days

    def is_free_period(self, booking: Booking, today: date | None = None) -> bool:
        return self.days_before_start(booking, today) >= self.free_days

    def cancellation_refund(self, booking: Booking, paid_amount: Decimal, today: date | None = None) -> Decimal:
        """Сума повернення при скасуванні клієнтом: 100 % або 0."""
        return money(paid_amount) if self.is_free_period(booking, today) else ZERO

    @staticmethod
    def ensure_can_cancel(booking: Booking) -> None:
        if booking.status == Booking.Status.CANCELLED:
            raise InvalidState("Бронювання вже скасоване.")

    def ensure_can_change(self, booking: Booking, today: date | None = None) -> None:
        if booking.status not in Booking.SEAT_STATUSES:
            raise PolicyViolation("Змінити можна лише оплачене або підтверджене бронювання.")
        if not self.is_free_period(booking, today):
            raise PolicyViolation(f"Зміна можлива не пізніше ніж за {self.free_days} днів до заїзду.")
