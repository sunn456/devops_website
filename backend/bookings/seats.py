"""Облік місць виїздів (FR-12, вимоги 2.3 і 2.4).

Зайняті місця = місця оплачених і підтверджених бронювань
             + місця з дійсними (не простроченими) утриманнями.
Рядок виїзду блокується (SELECT ... FOR UPDATE) на час перевірки та запису,
тому два клієнти не можуть одночасно забронювати останнє місце.
"""
from datetime import datetime, timedelta

from django.conf import settings
from django.db.models import F, Sum
from django.utils import timezone

from catalog.models import Departure

from .exceptions import NotEnoughSeats, NotFound
from .models import Booking, ChangeRequest, SeatHold


class SeatService:
    def __init__(self, hold_minutes: int | None = None):
        self.hold_minutes = hold_minutes or settings.WINTERRA["HOLD_MINUTES"]

    @staticmethod
    def lock_departures(*departure_ids: int) -> dict[int, Departure]:
        """Блокує рядки виїздів у порядку зростання id (щоб уникнути взаємоблокувань)."""
        ids = sorted(set(departure_ids))
        departures = {
            d.pk: d
            for d in Departure.objects.select_for_update().filter(pk__in=ids).order_by("pk")
        }
        if len(departures) != len(ids):
            raise NotFound("Виїзд не знайдено.")
        return departures

    def occupied_seats(self, departure: Departure, now: datetime | None = None) -> int:
        now = now or timezone.now()
        fixed = (
            Booking.objects.filter(departure=departure, status__in=Booking.SEAT_STATUSES)
            .aggregate(s=Sum(F("adults") + F("children")))["s"]
            or 0
        )
        held = (
            SeatHold.objects.filter(departure=departure, is_active=True, expires_at__gt=now)
            .aggregate(s=Sum("seats"))["s"]
            or 0
        )
        return fixed + held

    def free_seats(self, departure: Departure, now: datetime | None = None) -> int:
        return max(departure.total_seats - self.occupied_seats(departure, now), 0)

    def ensure_available(self, departure: Departure, seats: int, now: datetime | None = None) -> None:
        free = self.free_seats(departure, now)
        if seats > free:
            raise NotEnoughSeats(f"Недостатньо вільних місць: потрібно {seats}, вільно {free}.")

    def hold(
        self,
        departure: Departure,
        booking: Booking,
        seats: int,
        change_request: ChangeRequest | None = None,
        now: datetime | None = None,
    ) -> SeatHold:
        now = now or timezone.now()
        return SeatHold.objects.create(
            departure=departure,
            booking=booking,
            change_request=change_request,
            seats=seats,
            expires_at=now + timedelta(minutes=self.hold_minutes),
        )

    def hold_deadline(self, now: datetime | None = None) -> datetime:
        return (now or timezone.now()) + timedelta(minutes=self.hold_minutes)

    @staticmethod
    def active_hold(booking: Booking) -> SeatHold | None:
        """Утримання для нового бронювання (не для запиту на зміну)."""
        return booking.holds.filter(is_active=True, change_request__isnull=True).order_by("-expires_at").first()

    @staticmethod
    def release_holds(*, booking: Booking | None = None, change_request: ChangeRequest | None = None) -> int:
        qs = SeatHold.objects.filter(is_active=True)
        if booking is not None:
            qs = qs.filter(booking=booking)
        if change_request is not None:
            qs = qs.filter(change_request=change_request)
        return qs.update(is_active=False)

    @staticmethod
    def expired_holds(now: datetime):
        return SeatHold.objects.select_for_update().filter(is_active=True, expires_at__lte=now)
