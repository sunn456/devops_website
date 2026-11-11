"""Модульні та інтеграційні тести бізнес-логіки (основа для розділу 4)."""
import json
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Activity, Departure, Resort, SkiPass, Tour
from payments.gateway import TestPaymentGateway
from payments.models import Payment, Refund
from payments.services import PaymentService

from .exceptions import NotEnoughSeats, PolicyViolation, ValidationFailed
from .models import Booking, ChangeRequest
from .pricing import GroupComposition, PriceCalculator, SkiPassSelection
from .services import BookingService

CARD_OK = "4242424242424242"


class BaseCase(TestCase):
    def setUp(self):
        today = timezone.localdate()
        self.resort = Resort.objects.create(name="Буковель", country="Україна")
        self.other_resort = Resort.objects.create(name="Банско", country="Болгарія")
        self.tour = Tour.objects.create(
            resort=self.resort, title="Буковель 6 ночей", hotel_name="Готель", nights=6,
            adult_price=Decimal("14500"), child_price=Decimal("9800"),
        )
        self.dep = Departure.objects.create(
            tour=self.tour, start_date=today + timedelta(days=30), end_date=today + timedelta(days=36), total_seats=4
        )
        self.dep2 = Departure.objects.create(
            tour=self.tour, start_date=today + timedelta(days=37), end_date=today + timedelta(days=43), total_seats=10
        )
        self.adult_pass = SkiPass.objects.create(resort=self.resort, category="adult", duration_days=3, price=Decimal("4200"))
        self.child_pass = SkiPass.objects.create(resort=self.resort, category="child", duration_days=3, price=Decimal("2700"))
        self.foreign_pass = SkiPass.objects.create(resort=self.other_resort, category="adult", duration_days=3, price=1)
        self.spa = Activity.objects.create(title="SPA", price_per_person=Decimal("900"))
        self.gateway = TestPaymentGateway(fail_refunds=False)
        self.service = BookingService(payments=PaymentService(self.gateway))
        self.contact = {"first_name": "Олена", "last_name": "Коваль", "phone": "+380501234567", "email": "olena@test.ua"}

    def book(self, group=GroupComposition(2, 1, 1), departure=None, ski=None, acts=None):
        dep = departure or self.dep
        return self.service.create_booking(dep.pk, group, ski or [], acts or [], self.contact)

    def pay(self, payment, card=CARD_OK):
        body, sig = self.gateway.charge(payment.provider_ref, card)
        payment, _ = self.service.payments.handle_webhook(body, sig)
        return self.service.on_payment_result(payment)

    def paid_booking(self, **kw):
        result = self.book(**kw)
        self.pay(result.payment)
        result.booking.refresh_from_db()
        return result.booking


class PricingTests(BaseCase):
    def test_formula_adults_children_infants_skipasses_activities(self):
        """(2 × 14500) + (1 × 9800) + 2 × 4200 + 1 × 2700 + 2 × 900 = 51 700; малюк безкоштовно."""
        start = self.dep.start_date + timedelta(days=1)
        breakdown = self.service.quote(
            self.dep, GroupComposition(2, 1, 1),
            [{"ski_pass_id": self.adult_pass.pk, "start_date": start, "quantity": 2},
             {"ski_pass_id": self.child_pass.pk, "start_date": start, "quantity": 1}],
            [{"activity_id": self.spa.pk, "persons": 2}],
        )
        self.assertEqual(breakdown.total, Decimal("51700.00"))

    def test_rounding_to_two_decimals(self):
        self.tour.adult_price = Decimal("100.005")
        calc = PriceCalculator().calculate(self.dep, GroupComposition(1))
        self.assertEqual(calc.total, Decimal("100.01"))

    def test_ski_pass_outside_stay_rejected(self):
        start = self.dep.end_date - timedelta(days=1)  # 3 дні виходять за межі
        with self.assertRaises(ValidationFailed):
            self.service.quote(self.dep, GroupComposition(1), [{"ski_pass_id": self.adult_pass.pk, "start_date": start, "quantity": 1}], [])

    def test_more_ski_passes_than_people_rejected(self):
        with self.assertRaises(ValidationFailed):
            self.service.quote(self.dep, GroupComposition(1), [{"ski_pass_id": self.adult_pass.pk, "start_date": self.dep.start_date, "quantity": 2}], [])

    def test_child_pass_without_children_rejected(self):
        with self.assertRaises(ValidationFailed):
            self.service.quote(self.dep, GroupComposition(2, 0, 1), [{"ski_pass_id": self.child_pass.pk, "start_date": self.dep.start_date, "quantity": 1}], [])

    def test_foreign_resort_ski_pass_rejected(self):
        with self.assertRaises(ValidationFailed):
            self.service.quote(self.dep, GroupComposition(1), [{"ski_pass_id": self.foreign_pass.pk, "start_date": self.dep.start_date, "quantity": 1}], [])

    def test_infant_requires_adult(self):
        with self.assertRaises(ValidationFailed):
            self.service.quote(self.dep, GroupComposition(1, 0, 2), [], [])


class SeatTests(BaseCase):
    def test_hold_reduces_free_seats_and_infants_not_counted(self):
        self.book(GroupComposition(2, 1, 1))
        self.assertEqual(self.service.seats.free_seats(self.dep), 1)

    def test_cannot_overbook(self):
        self.book(GroupComposition(3))
        with self.assertRaises(NotEnoughSeats):
            self.book(GroupComposition(2))

    def test_expired_hold_cancels_booking_and_frees_seats(self):
        result = self.book(GroupComposition(4))
        later = timezone.now() + timedelta(minutes=16)
        self.service.expire_holds(now=later)
        result.booking.refresh_from_db()
        self.assertEqual(result.booking.status, Booking.Status.CANCELLED)
        self.assertEqual(self.service.seats.free_seats(self.dep, later), 4)


class PaymentFlowTests(BaseCase):
    def test_successful_payment_sets_paid_and_code(self):
        booking = self.paid_booking()
        self.assertEqual(booking.status, Booking.Status.PAID)
        self.assertRegex(booking.code, r"^BK-\d{5}$")
        self.assertEqual(booking.holds.filter(is_active=True).count(), 0)
        self.assertEqual(self.service.seats.free_seats(self.dep), 1)

    def test_declined_card_keeps_new_and_retry_possible(self):
        result = self.book()
        self.pay(result.payment, card=TestPaymentGateway.DECLINED_CARD)
        result.booking.refresh_from_db()
        self.assertEqual(result.booking.status, Booking.Status.NEW)
        retry = self.service.restart_payment(result.booking.pk)
        self.pay(retry.payment)
        result.booking.refresh_from_db()
        self.assertEqual(result.booking.status, Booking.Status.PAID)

    def test_invalid_signature_rejected(self):
        result = self.book()
        body = json.dumps({"provider_ref": result.payment.provider_ref, "status": "succeeded"}).encode()
        with self.assertRaises(Exception):
            self.service.payments.handle_webhook(body, "bad")

    def test_late_payment_without_seats_is_refunded(self):
        first = self.book(GroupComposition(4))
        later = timezone.now() + timedelta(minutes=16)
        self.service.expire_holds(now=later)
        self.paid_booking(group=GroupComposition(4))  # хтось інший зайняв усі місця
        with mock.patch("django.utils.timezone.now", return_value=later):
            self.pay(first.payment)
        first.booking.refresh_from_db()
        self.assertEqual(first.booking.status, Booking.Status.CANCELLED)
        self.assertEqual(first.booking.refunds.get().status, Refund.Status.SUCCEEDED)

    def test_late_payment_with_free_seats_is_accepted(self):
        first = self.book(GroupComposition(2))
        later = timezone.now() + timedelta(minutes=16)
        self.service.expire_holds(now=later)
        with mock.patch("django.utils.timezone.now", return_value=later):
            self.pay(first.payment)
        first.booking.refresh_from_db()
        self.assertEqual(first.booking.status, Booking.Status.PAID)


class CancellationTests(BaseCase):
    def test_full_refund_7_or_more_days_before(self):
        booking = self.paid_booking()
        result = self.service.cancel(booking.pk, by=Booking.CancelledBy.CLIENT)
        self.assertTrue(result.completed)
        self.assertEqual(result.refund_amount, booking.total_amount)
        self.assertEqual(self.service.seats.free_seats(self.dep), 4)

    def test_no_refund_less_than_7_days(self):
        booking = self.paid_booking()
        with mock.patch("django.utils.timezone.localdate", return_value=self.dep.start_date - timedelta(days=6)):
            result = self.service.cancel(booking.pk, by=Booking.CancelledBy.CLIENT)
        self.assertEqual(result.refund_amount, Decimal("0.00"))
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)

    def test_failed_refund_keeps_booking_and_admin_retry_completes(self):
        booking = self.paid_booking()
        self.gateway.fail_refunds = True
        result = self.service.cancel(booking.pk, by=Booking.CancelledBy.CLIENT)
        booking.refresh_from_db()
        self.assertFalse(result.completed)
        self.assertEqual(booking.status, Booking.Status.PAID)
        self.gateway.fail_refunds = False
        self.service.retry_refund(result.refunds[0].pk)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)

    def test_agency_cancels_departure(self):
        b1 = self.paid_booking(group=GroupComposition(2))
        b2 = self.paid_booking(group=GroupComposition(1))
        self.service.cancel_departure(self.dep.pk)
        for b in (b1, b2):
            b.refresh_from_db()
            self.assertEqual(b.status, Booking.Status.CANCELLED)
            self.assertEqual(self.service.payments.net_paid(b), Decimal("0.00"))

    def test_admin_confirm(self):
        booking = self.paid_booking()
        self.service.confirm(booking.pk)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)


class ChangeTests(BaseCase):
    def test_change_with_surcharge(self):
        booking = self.paid_booking(group=GroupComposition(1))
        result = self.service.request_change(booking.pk, self.dep2.pk, GroupComposition(2), [], [])
        self.assertFalse(result.applied)
        self.assertEqual(result.difference, Decimal("14500.00"))
        self.pay(result.payment)
        booking.refresh_from_db()
        self.assertEqual((booking.departure_id, booking.adults), (self.dep2.pk, 2))
        self.assertEqual(self.service.seats.free_seats(self.dep), 4)
        self.assertEqual(self.service.seats.free_seats(self.dep2), 8)

    def test_change_with_refund_of_difference(self):
        booking = self.paid_booking(group=GroupComposition(2, 1))
        result = self.service.request_change(booking.pk, self.dep.pk, GroupComposition(2), [], [])
        self.assertTrue(result.applied)
        self.assertEqual(result.refunds[0].amount, Decimal("9800.00"))
        booking.refresh_from_db()
        self.assertEqual(booking.total_amount, Decimal("29000.00"))

    def test_unpaid_surcharge_leaves_booking_unchanged(self):
        booking = self.paid_booking(group=GroupComposition(1))
        result = self.service.request_change(booking.pk, self.dep2.pk, GroupComposition(2), [], [])
        self.service.expire_holds(now=timezone.now() + timedelta(minutes=16))
        result.change_request.refresh_from_db()
        booking.refresh_from_db()
        self.assertEqual(result.change_request.status, ChangeRequest.Status.EXPIRED)
        self.assertEqual(booking.departure_id, self.dep.pk)

    def test_change_forbidden_less_than_7_days(self):
        booking = self.paid_booking(group=GroupComposition(1))
        with mock.patch("django.utils.timezone.localdate", return_value=self.dep.start_date - timedelta(days=3)):
            with self.assertRaises(PolicyViolation):
                self.service.request_change(booking.pk, self.dep2.pk, GroupComposition(1), [], [])


@override_settings(WINTERRA={
    "HOLD_MINUTES": 15, "FREE_CHANGE_CANCEL_DAYS": 7, "FRONTEND_URL": "http://localhost:5173",
    "PAYMENT_GATEWAY": "payments.gateway.TestPaymentGateway", "PAYMENT_WEBHOOK_SECRET": "s",
    "TEST_GATEWAY_FAIL_REFUNDS": False,
})
class ApiTests(BaseCase):
    """Інтеграційний сценарій через REST API: пошук → бронювання → оплата → «Моє бронювання»."""

    def test_full_client_flow_and_admin_security(self):
        api = APIClient()
        r = api.get("/api/departures/search/", {"resort": self.resort.pk, "date": self.dep.start_date, "adults": 2, "children": 1})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["results"]), 2)

        r = api.post("/api/bookings/", {"departure_id": self.dep.pk, "adults": 2, "children": 1, **self.contact}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        ref = r.data["checkout_url"].rsplit("/", 1)[-1]

        r = api.post("/api/test-gateway/charge/", {"provider_ref": ref, "card_number": CARD_OK, "expiry": "12/28", "cvv": "123"}, format="json")
        self.assertEqual(r.data["status"], "succeeded")
        code = Booking.objects.get().code

        r = api.post("/api/my-booking/", {"code": code, "email": "OLENA@test.ua"}, format="json")
        self.assertEqual(r.data["status"], "paid")
        r = api.post("/api/my-booking/", {"code": code, "email": "wrong@test.ua"}, format="json")
        self.assertEqual(r.status_code, 404)

        # адміністративні дії без входу заборонені
        self.assertEqual(api.get("/api/admin/bookings/").status_code, 401)
        get_user_model().objects.create_user("admin", password="pass12345", is_staff=True)
        token = api.post("/api/auth/login/", {"username": "admin", "password": "pass12345"}, format="json").data["token"]
        api.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        booking_id = Booking.objects.get().pk
        self.assertEqual(api.post(f"/api/admin/bookings/{booking_id}/confirm/").data["status"], "confirmed")
        r = api.get("/api/admin/reports/", {"type": "revenue", "date_from": timezone.localdate(), "date_to": timezone.localdate()})
        self.assertEqual(r.data["data"]["net"], Decimal("38800.00"))


class TransactionalApiTests(TransactionTestCase):
    """Регресійні тести поза обгорткою TestCase: кожен запит працює у власних транзакціях,
    як на справжньому сервері (TestCase приховує помилки на кшталт select_for_update поза транзакцією)."""

    def setUp(self):
        BaseCase.setUp(self)
        self.client = APIClient()

    def create_booking(self):
        res = self.client.post(
            "/api/bookings/",
            {"departure_id": self.dep.pk, "adults": 2, "children": 0, "infants": 0, **self.contact},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()["checkout_url"].rsplit("/", 1)[1]

    def charge(self, ref, card):
        return self.client.post(
            "/api/test-gateway/charge/",
            {"provider_ref": ref, "card_number": card, "expiry": "12/30", "cvv": "123"},
            format="json",
        )

    def test_declined_then_successful_payment_via_api(self):
        ref = self.create_booking()
        res = self.charge(ref, "4000000000000002")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "failed")
        public_id = res.json()["booking_public_id"]
        retry = self.client.post(f"/api/bookings/{public_id}/pay/")
        res = self.charge(retry.json()["checkout_url"].rsplit("/", 1)[1], CARD_OK)
        self.assertEqual(res.json()["status"], "succeeded")
        self.assertEqual(Booking.objects.get(public_id=public_id).status, Booking.Status.PAID)

    def test_reports_count_todays_bookings(self):
        self.charge(self.create_booking(), CARD_OK)
        admin = get_user_model().objects.create_superuser("admin", "a@test.ua", "pass12345")
        self.client.force_authenticate(admin)
        today = timezone.localdate().isoformat()
        res = self.client.get("/api/admin/reports/", {"type": "bookings", "date_from": today, "date_to": today})
        self.assertEqual(res.json()["data"]["total"], 1)
        res = self.client.get("/api/admin/reports/", {"type": "revenue", "date_from": today, "date_to": today})
        self.assertEqual(Decimal(str(res.json()["data"]["received"])), Decimal("29000"))
