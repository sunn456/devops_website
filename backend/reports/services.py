"""Модуль reports: звіти за період (FR-17)."""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum
from django.utils import timezone

from bookings.models import Booking
from bookings.pricing import ZERO, money
from payments.models import Payment, Refund


def period(field: str, date_from: date, date_to: date) -> dict:
    """Умова «поле потрапляє в період [date_from; date_to]» за місцевим часом.

    Межі обчислюються в Python, а не через __date у SQL: MySQL без завантажених
    таблиць часових поясів не перетворює дати (CONVERT_TZ повертає NULL).
    """
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(date_from, time.min), tz)
    end = timezone.make_aware(datetime.combine(date_to + timedelta(days=1), time.min), tz)
    return {f"{field}__gte": start, f"{field}__lt": end}


class ReportService:
    SOLD = Booking.SEAT_STATUSES

    def bookings_summary(self, date_from: date, date_to: date) -> dict:
        qs = Booking.objects.filter(**period("created_at", date_from, date_to))
        by_status = {row["status"]: row["n"] for row in qs.values("status").annotate(n=Count("id"))}
        sold = qs.filter(status__in=self.SOLD)
        return {
            "total": qs.count(),
            "by_status": {label: by_status.get(value, 0) for value, label in Booking.Status.choices},
            "participants": sold.aggregate(n=Sum(F("adults") + F("children") + F("infants")))["n"] or 0,
        }

    def revenue(self, date_from: date, date_to: date) -> dict:
        """Дохід = проведені платежі − виконані повернення, з розбивкою за місяцями."""
        months: dict[str, Decimal] = defaultdict(lambda: ZERO)
        payments = Payment.objects.filter(status=Payment.Status.SUCCEEDED, **period("paid_at", date_from, date_to))
        refunds = Refund.objects.filter(status=Refund.Status.SUCCEEDED, **period("processed_at", date_from, date_to))
        for paid_at, amount in payments.values_list("paid_at", "amount"):
            months[timezone.localtime(paid_at).strftime("%Y-%m")] += amount
        for processed_at, amount in refunds.values_list("processed_at", "amount"):
            months[timezone.localtime(processed_at).strftime("%Y-%m")] -= amount
        received = payments.aggregate(s=Sum("amount"))["s"] or ZERO
        returned = refunds.aggregate(s=Sum("amount"))["s"] or ZERO
        return {
            "received": money(received),
            "refunded": money(returned),
            "net": money(received - returned),
            "by_month": [{"month": m, "net": money(v)} for m, v in sorted(months.items())],
        }

    def popular_tours(self, date_from: date, date_to: date, limit: int = 10) -> list[dict]:
        return list(
            Booking.objects.filter(status__in=self.SOLD, **period("created_at", date_from, date_to))
            .values(tour_id=F("departure__tour_id"), tour=F("departure__tour__title"), resort=F("departure__tour__resort__name"))
            .annotate(bookings=Count("id"), participants=Sum(F("adults") + F("children") + F("infants")), revenue=Sum("total_amount"))
            .order_by("-bookings", "-revenue")[:limit]
        )

    def popular_resorts(self, date_from: date, date_to: date) -> list[dict]:
        return list(
            Booking.objects.filter(status__in=self.SOLD, **period("created_at", date_from, date_to))
            .values(resort_id=F("departure__tour__resort_id"), resort=F("departure__tour__resort__name"))
            .annotate(bookings=Count("id"), participants=Sum(F("adults") + F("children") + F("infants")), revenue=Sum("total_amount"))
            .order_by("-bookings", "-revenue")
        )
