"""BookingService — оформлення, оплата, підтвердження, скасування та зміна бронювань.

Клас координує роботу інших сервісів: SelectionValidator і PriceCalculator
(розрахунок), SeatService (облік місць), BookingPolicy (правила),
PaymentService (платежі) та NotificationService (листи).
"""
import secrets
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from catalog.models import Activity, Departure, SkiPass
from notifications.services import NotificationService
from payments.models import Payment, Refund
from payments.services import PaymentService

from .exceptions import InvalidState, NotFound, PolicyViolation, ValidationFailed
from .models import Booking, BookingActivity, BookingSkiPass, ChangeRequest
from .policy import BookingPolicy
from .pricing import (
    ActivitySelection,
    GroupComposition,
    PriceBreakdown,
    PriceCalculator,
    SelectionValidator,
    SkiPassSelection,
    money,
)
from .seats import SeatService


@dataclass
class CheckoutResult:
    booking: Booking
    payment: Payment
    checkout_url: str
    hold_expires_at: datetime


@dataclass
class CancellationResult:
    booking: Booking
    refund_amount: Decimal
    refunds: list[Refund] = field(default_factory=list)
    completed: bool = True


@dataclass
class ChangeResult:
    booking: Booking
    change_request: ChangeRequest
    breakdown: PriceBreakdown
    difference: Decimal
    applied: bool
    payment: Payment | None = None
    checkout_url: str | None = None
    refunds: list[Refund] = field(default_factory=list)


class BookingService:
    def __init__(
        self,
        *,
        validator: SelectionValidator | None = None,
        calculator: PriceCalculator | None = None,
        seats: SeatService | None = None,
        policy: BookingPolicy | None = None,
        payments: PaymentService | None = None,
        notifier: NotificationService | None = None,
    ):
        self.validator = validator or SelectionValidator()
        self.calculator = calculator or PriceCalculator()
        self.seats = seats or SeatService()
        self.policy = policy or BookingPolicy()
        self.payments = payments or PaymentService()
        self.notifier = notifier or NotificationService()

    # ------------------------------------------------------------------ вибір і розрахунок

    @staticmethod
    def build_selection(ski_pass_items: list[dict], activity_items: list[dict]):
        """Перетворює дані запиту ({ski_pass_id, start_date, quantity}, {activity_id, persons})
        на об'єкти вибору з довідників."""
        ski_pass_items = ski_pass_items or []
        activity_items = activity_items or []
        passes = SkiPass.objects.in_bulk([i["ski_pass_id"] for i in ski_pass_items])
        acts = Activity.objects.in_bulk([i["activity_id"] for i in activity_items])
        ski_passes, activities = [], []
        for item in ski_pass_items:
            ski_pass = passes.get(item["ski_pass_id"])
            if ski_pass is None:
                raise ValidationFailed("Скі-пас не знайдено.")
            start = item["start_date"]
            if isinstance(start, str):
                start = date.fromisoformat(start)
            ski_passes.append(SkiPassSelection(ski_pass, start, int(item["quantity"])))
        for item in activity_items:
            activity = acts.get(item["activity_id"])
            if activity is None:
                raise ValidationFailed("Активність не знайдено.")
            activities.append(ActivitySelection(activity, int(item["persons"])))
        return ski_passes, activities

    def quote(self, departure: Departure, group: GroupComposition, ski_items, activity_items) -> PriceBreakdown:
        ski_passes, activities = self.build_selection(ski_items, activity_items)
        self.validator.validate(departure, group, ski_passes, activities)
        return self.calculator.calculate(departure, group, ski_passes, activities)

    # ------------------------------------------------------------------ оформлення та оплата

    @transaction.atomic
    def create_booking(self, departure_id: int, group: GroupComposition, ski_items, activity_items, contact: dict):
        """FR-05, FR-06: розрахунок, бронювання «нове», утримання місць на 15 хв, перехід до оплати."""
        departure = self.seats.lock_departures(departure_id)[departure_id]
        ski_passes, activities = self.build_selection(ski_items, activity_items)
        self.validator.validate(departure, group, ski_passes, activities)
        self.seats.ensure_available(departure, group.seats)
        breakdown = self.calculator.calculate(departure, group, ski_passes, activities)

        booking = Booking.objects.create(
            departure=departure,
            adults=group.adults,
            children=group.children,
            infants=group.infants,
            total_amount=breakdown.total,
            **contact,
        )
        self._save_items(booking, ski_passes, activities)
        hold = self.seats.hold(departure, booking, group.seats)
        payment, url = self.payments.start_payment(booking, booking.total_amount)
        return CheckoutResult(booking, payment, url, hold.expires_at)

    @transaction.atomic
    def restart_payment(self, booking_id: int) -> CheckoutResult:
        """Повторна спроба оплати, доки діє утримання (альтернатива 4а)."""
        booking = Booking.objects.select_for_update().get(pk=booking_id)
        if booking.status != Booking.Status.NEW:
            raise InvalidState("Бронювання вже оплачене або скасоване.")
        hold = self.seats.active_hold(booking)
        if hold is None or hold.expires_at <= timezone.now():
            raise PolicyViolation("Час утримання місць минув. Оформіть бронювання заново.")
        payment, url = self.payments.start_payment(booking, booking.total_amount)
        return CheckoutResult(booking, payment, url, hold.expires_at)

    @transaction.atomic
    def on_payment_result(self, payment: Payment) -> Booking:
        """Обробляє результат оплати, отриманий від платіжного сервісу."""
        if payment.change_request_id:
            if payment.status == Payment.Status.SUCCEEDED:
                self._apply_paid_change(payment)
            else:
                self._abort_change(payment.change_request)
            return payment.booking
        if payment.status == Payment.Status.SUCCEEDED:
            return self._mark_paid(payment)
        return payment.booking  # невдала оплата — клієнт може повторити, доки діє утримання

    def _mark_paid(self, payment: Payment) -> Booking:
        booking = Booking.objects.select_for_update().get(pk=payment.booking_id)
        departure = self.seats.lock_departures(booking.departure_id)[booking.departure_id]
        now = timezone.now()

        if booking.status in Booking.SEAT_STATUSES:
            # повторна оплата вже оплаченого бронювання — повертаємо зайве
            self.payments.refund(booking, payment.amount, Refund.Reason.DUPLICATE)
            return booking
        if booking.status == Booking.Status.CANCELLED and booking.cancelled_by != Booking.CancelledBy.SYSTEM:
            self.payments.refund(booking, payment.amount, Refund.Reason.DUPLICATE)
            return booking

        hold = self.seats.active_hold(booking)
        hold_valid = hold is not None and hold.expires_at > now and booking.status == Booking.Status.NEW
        if not hold_valid:
            # альтернатива 5а: оплата надійшла після завершення утримання
            self.seats.release_holds(booking=booking)
            if not departure.is_active or self.seats.free_seats(departure, now) < booking.seats:
                booking.status = Booking.Status.CANCELLED
                booking.cancelled_by = Booking.CancelledBy.SYSTEM
                booking.cancelled_at = booking.cancelled_at or now
                booking.cancel_reason = "Оплата надійшла після завершення утримання, вільних місць немає."
                booking.save()
                self.payments.refund(booking, payment.amount, Refund.Reason.LATE_PAYMENT)
                return booking

        booking.status = Booking.Status.PAID
        booking.paid_at = now
        booking.code = booking.code or self._generate_code()
        booking.cancelled_at = None
        booking.cancelled_by = ""
        booking.cancel_reason = ""
        booking.save()
        self.seats.release_holds(booking=booking)  # місця тепер закріплені статусом «оплачене»
        transaction.on_commit(lambda: self.notifier.send_booking_code(booking))
        return booking

    @transaction.atomic
    def expire_holds(self, now: datetime | None = None) -> dict:
        """Фонове завдання: знімає прострочені утримання й скасовує неоплачені бронювання."""
        now = now or timezone.now()
        cancelled = expired_changes = 0
        for hold in self.seats.expired_holds(now):
            hold.is_active = False
            hold.save(update_fields=["is_active"])
            if hold.change_request_id:
                expired_changes += ChangeRequest.objects.filter(
                    pk=hold.change_request_id, status=ChangeRequest.Status.PENDING
                ).update(status=ChangeRequest.Status.EXPIRED)
            else:
                cancelled += Booking.objects.filter(pk=hold.booking_id, status=Booking.Status.NEW).update(
                    status=Booking.Status.CANCELLED,
                    cancelled_by=Booking.CancelledBy.SYSTEM,
                    cancelled_at=now,
                    cancel_reason="Оплату не завершено протягом часу утримання місць.",
                )
        expired_changes += ChangeRequest.objects.filter(
            status=ChangeRequest.Status.PENDING, expires_at__lte=now
        ).update(status=ChangeRequest.Status.EXPIRED)
        return {"cancelled_bookings": cancelled, "expired_changes": expired_changes}

    # ------------------------------------------------------------------ пошук і підтвердження

    @staticmethod
    def find_by_code(code: str, email: str) -> Booking:
        """FR-09: доступ клієнта до бронювання без облікового запису."""
        booking = (
            Booking.objects.select_related("departure__tour__resort")
            .filter(code__iexact=code.strip(), email__iexact=email.strip())
            .first()
        )
        if booking is None:
            raise NotFound("Бронювання з таким кодом та email не знайдено.")
        return booking

    @transaction.atomic
    def confirm(self, booking_id: int) -> Booking:
        """FR-15: адміністратор підтверджує оплачене бронювання."""
        booking = Booking.objects.select_for_update().get(pk=booking_id)
        if booking.status != Booking.Status.PAID:
            raise InvalidState("Підтвердити можна лише бронювання зі статусом «оплачене».")
        booking.status = Booking.Status.CONFIRMED
        booking.confirmed_at = timezone.now()
        booking.save(update_fields=["status", "confirmed_at"])
        return booking

    # ------------------------------------------------------------------ скасування

    def preview_cancellation(self, booking: Booking) -> dict:
        self.policy.ensure_can_cancel(booking)
        paid = self.payments.net_paid(booking)
        return {
            "days_before_start": self.policy.days_before_start(booking),
            "paid_amount": paid,
            "refund_amount": self.policy.cancellation_refund(booking, paid),
            "full_refund": self.policy.is_free_period(booking),
        }

    @transaction.atomic
    def cancel(
        self,
        booking_id: int,
        *,
        by: str,
        reason: str = "",
        full_refund: bool = False,
        strict_refund: bool | None = None,
    ) -> CancellationResult:
        """FR-10, FR-15. full_refund=True — повертається вся отримана сума (адміністратор, агенція).

        strict_refund: якщо повернення не вдалося, бронювання не скасовується, а повернення
        передається адміністратору (за замовчуванням — для скасування клієнтом).
        """
        booking = Booking.objects.select_for_update().get(pk=booking_id)
        self.policy.ensure_can_cancel(booking)
        if booking.refunds.filter(status=Refund.Status.FAILED, reason=Refund.Reason.CANCELLATION).exists():
            raise InvalidState("Повернення коштів за цим бронюванням уже передано адміністратору.")

        paid = self.payments.net_paid(booking)
        amount = paid if full_refund else self.policy.cancellation_refund(booking, paid)
        refunds = self.payments.refund(booking, amount, Refund.Reason.CANCELLATION)
        failed = any(r.status == Refund.Status.FAILED for r in refunds)
        strict = (by == Booking.CancelledBy.CLIENT) if strict_refund is None else strict_refund
        if failed and strict:
            return CancellationResult(booking, amount, refunds, completed=False)
        self._finalize_cancellation(booking, by, reason)
        return CancellationResult(booking, amount, refunds, completed=True)

    @transaction.atomic
    def retry_refund(self, refund_id: int) -> Refund:
        """Адміністратор повторює невдале повернення; після успіху завершується скасування."""
        refund = Refund.objects.select_for_update().get(pk=refund_id)
        self.payments.retry_refund(refund)
        if refund.status == Refund.Status.SUCCEEDED and refund.reason == Refund.Reason.CANCELLATION:
            booking = Booking.objects.select_for_update().get(pk=refund.booking_id)
            still_failed = booking.refunds.filter(
                status=Refund.Status.FAILED, reason=Refund.Reason.CANCELLATION
            ).exists()
            if booking.status != Booking.Status.CANCELLED and not still_failed:
                self._finalize_cancellation(booking, Booking.CancelledBy.CLIENT, "Скасовано після повернення коштів")
        return refund

    @transaction.atomic
    def cancel_departure(self, departure_id: int, reason: str = "") -> list[CancellationResult]:
        """FR-14: агенція скасовує виїзд — усі бронювання скасовуються з повним поверненням."""
        departure = self.seats.lock_departures(departure_id)[departure_id]
        if not departure.is_active:
            raise InvalidState("Виїзд уже скасовано.")
        departure.status = Departure.Status.CANCELLED
        departure.save(update_fields=["status"])

        for cr in ChangeRequest.objects.filter(new_departure=departure, status=ChangeRequest.Status.PENDING):
            self._abort_change(cr)

        reason = reason or "Агенція скасувала виїзд."
        return [
            self.cancel(b.pk, by=Booking.CancelledBy.AGENCY, reason=reason, full_refund=True, strict_refund=False)
            for b in departure.bookings.exclude(status=Booking.Status.CANCELLED)
        ]

    def _finalize_cancellation(self, booking: Booking, by: str, reason: str) -> None:
        booking.status = Booking.Status.CANCELLED
        booking.cancelled_by = by
        booking.cancel_reason = reason
        booking.cancelled_at = timezone.now()
        booking.save()
        self.seats.release_holds(booking=booking)
        booking.change_requests.filter(status=ChangeRequest.Status.PENDING).update(
            status=ChangeRequest.Status.CANCELLED
        )
        transaction.on_commit(lambda: self.notifier.send_cancellation(booking))

    # ------------------------------------------------------------------ зміна бронювання

    def _prepare_change(self, booking, new_departure, group, ski_items, activity_items):
        self.policy.ensure_can_change(booking)
        ski_passes, activities = self.build_selection(ski_items, activity_items)
        self.validator.validate(new_departure, group, ski_passes, activities)
        breakdown = self.calculator.calculate(new_departure, group, ski_passes, activities)
        same_departure = new_departure.pk == booking.departure_id
        extra_seats = group.seats - (booking.seats if same_departure else 0)
        if extra_seats > 0:
            self.seats.ensure_available(new_departure, extra_seats)
        difference = money(breakdown.total - booking.total_amount)
        return ski_passes, activities, breakdown, extra_seats, difference

    def quote_change(self, booking: Booking, new_departure_id: int, group, ski_items, activity_items) -> dict:
        new_departure = Departure.objects.select_related("tour").filter(pk=new_departure_id).first()
        if new_departure is None:
            raise NotFound("Виїзд не знайдено.")
        *_, breakdown, _, difference = self._prepare_change(booking, new_departure, group, ski_items, activity_items)
        return {"breakdown": breakdown, "difference": difference}

    @transaction.atomic
    def request_change(self, booking_id: int, new_departure_id: int, group, ski_items, activity_items) -> ChangeResult:
        """FR-11: зміна виїзду чи складу групи з доплатою або поверненням різниці."""
        booking = Booking.objects.select_for_update().get(pk=booking_id)
        departures = self.seats.lock_departures(booking.departure_id, new_departure_id)
        new_departure = departures[new_departure_id]

        for old in booking.change_requests.filter(status=ChangeRequest.Status.PENDING):
            self._abort_change(old)

        ski_passes, activities, breakdown, extra_seats, difference = self._prepare_change(
            booking, new_departure, group, ski_items, activity_items
        )
        cr = ChangeRequest.objects.create(
            booking=booking,
            new_departure=new_departure,
            adults=group.adults,
            children=group.children,
            infants=group.infants,
            items=self._serialize_items(ski_passes, activities),
            old_total=booking.total_amount,
            new_total=breakdown.total,
            difference=difference,
            expires_at=self.seats.hold_deadline(),
        )
        if difference > 0:
            if extra_seats > 0:
                self.seats.hold(new_departure, booking, extra_seats, change_request=cr)
            payment, url = self.payments.start_payment(booking, difference, Payment.Kind.SURCHARGE, cr)
            return ChangeResult(booking, cr, breakdown, difference, applied=False, payment=payment, checkout_url=url)

        self._apply_change(cr, ski_passes, activities)
        refunds = self.payments.refund(booking, -difference, Refund.Reason.CHANGE) if difference < 0 else []
        return ChangeResult(booking, cr, breakdown, difference, applied=True, refunds=refunds)

    def _apply_paid_change(self, payment: Payment) -> None:
        cr = ChangeRequest.objects.select_for_update().get(pk=payment.change_request_id)
        booking = Booking.objects.select_for_update().get(pk=cr.booking_id)
        departures = self.seats.lock_departures(booking.departure_id, cr.new_departure_id)
        now = timezone.now()

        if cr.status != ChangeRequest.Status.PENDING or booking.status not in Booking.SEAT_STATUSES:
            self._abort_change(cr)
            self.payments.refund(booking, payment.amount, Refund.Reason.CHANGE)
            return
        if cr.expires_at and cr.expires_at <= now:
            # доплата надійшла пізно — застосовуємо лише за наявності місць
            self.seats.release_holds(change_request=cr)
            same = cr.new_departure_id == booking.departure_id
            extra = cr.seats - (booking.seats if same else 0)
            new_dep = departures[cr.new_departure_id]
            if not new_dep.is_active or (extra > 0 and self.seats.free_seats(new_dep, now) < extra):
                cr.status = ChangeRequest.Status.EXPIRED
                cr.save(update_fields=["status"])
                self.payments.refund(booking, payment.amount, Refund.Reason.CHANGE)
                return
        self._apply_change(cr)

    def _apply_change(self, cr: ChangeRequest, ski_passes=None, activities=None) -> None:
        booking = cr.booking
        if ski_passes is None:
            ski_passes, activities = self.build_selection(
                cr.items.get("ski_passes", []), cr.items.get("activities", [])
            )
        booking.departure = cr.new_departure
        booking.adults, booking.children, booking.infants = cr.adults, cr.children, cr.infants
        booking.total_amount = cr.new_total
        booking.save()
        booking.ski_passes.all().delete()
        booking.activities.all().delete()
        self._save_items(booking, ski_passes, activities)
        self.seats.release_holds(change_request=cr)
        cr.status = ChangeRequest.Status.APPLIED
        cr.applied_at = timezone.now()
        cr.save(update_fields=["status", "applied_at"])
        transaction.on_commit(lambda: self.notifier.send_change_applied(booking))

    def _abort_change(self, cr: ChangeRequest) -> None:
        self.seats.release_holds(change_request=cr)
        if cr.status == ChangeRequest.Status.PENDING:
            cr.status = ChangeRequest.Status.CANCELLED
            cr.save(update_fields=["status"])

    # ------------------------------------------------------------------ допоміжні методи

    @staticmethod
    def _save_items(booking, ski_passes: list[SkiPassSelection], activities: list[ActivitySelection]) -> None:
        BookingSkiPass.objects.bulk_create(
            BookingSkiPass(
                booking=booking,
                ski_pass=s.ski_pass,
                start_date=s.start_date,
                end_date=s.end_date,
                quantity=s.quantity,
                unit_price=s.ski_pass.price,
                line_total=money(s.ski_pass.price * s.quantity),
            )
            for s in ski_passes
        )
        BookingActivity.objects.bulk_create(
            BookingActivity(
                booking=booking,
                activity=a.activity,
                persons=a.persons,
                unit_price=a.activity.price_per_person,
                line_total=money(a.activity.price_per_person * a.persons),
            )
            for a in activities
        )

    @staticmethod
    def _serialize_items(ski_passes, activities) -> dict:
        return {
            "ski_passes": [
                {"ski_pass_id": s.ski_pass.pk, "start_date": s.start_date.isoformat(), "quantity": s.quantity}
                for s in ski_passes
            ],
            "activities": [{"activity_id": a.activity.pk, "persons": a.persons} for a in activities],
        }

    @staticmethod
    def _generate_code() -> str:
        for _ in range(20):
            code = f"BK-{secrets.randbelow(90000) + 10000}"
            if not Booking.objects.filter(code=code).exists():
                return code
        return f"BK-{secrets.token_hex(4).upper()}"
