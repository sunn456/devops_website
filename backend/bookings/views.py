from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Departure

from .exceptions import NotFound
from .models import Booking
from .serializers import (
    AdminBookingSerializer,
    BookingSerializer,
    ChangeBookingSerializer,
    CreateBookingSerializer,
    LookupSerializer,
    SelectionSerializer,
)
from .services import BookingService


def checkout_response(result, http_status=status.HTTP_200_OK):
    return Response(
        {
            "booking": BookingSerializer(result.booking).data,
            "payment_id": result.payment.pk,
            "checkout_url": result.checkout_url,
            "hold_expires_at": result.hold_expires_at,
        },
        status=http_status,
    )


class QuoteView(APIView):
    """FR-05: попередній розрахунок вартості (підсумок замовлення)."""

    def post(self, request):
        s = SelectionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        departure = Departure.objects.select_related("tour").filter(pk=s.validated_data["departure_id"]).first()
        if departure is None:
            raise NotFound("Виїзд не знайдено.")
        breakdown = BookingService().quote(
            departure, s.group(), s.validated_data["ski_passes"], s.validated_data["activities"]
        )
        return Response(breakdown.as_dict())


class CreateBookingView(APIView):
    """FR-06: створення бронювання й перехід до оплати."""

    def post(self, request):
        s = CreateBookingSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        result = BookingService().create_booking(
            d["departure_id"], s.group(), d["ski_passes"], d["activities"], s.contact()
        )
        return checkout_response(result, status.HTTP_201_CREATED)


class BookingByPublicIdView(APIView):
    """Сторінка підтвердження після оплати (доступ за секретним public_id)."""

    def get(self, request, public_id):
        booking = get_object_or_404(Booking, public_id=public_id)
        return Response(BookingSerializer(booking).data)


class RetryPaymentView(APIView):
    def post(self, request, public_id):
        booking = get_object_or_404(Booking, public_id=public_id)
        return checkout_response(BookingService().restart_payment(booking.pk))


# ---------------------------------------------------------------- «Моє бронювання» (за кодом і email)


class MyBookingView(APIView):
    def post(self, request):
        s = LookupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        service = BookingService()
        booking = service.find_by_code(s.validated_data["code"], s.validated_data["email"])
        data = BookingSerializer(booking).data
        data["can_cancel"] = booking.status != Booking.Status.CANCELLED
        data["can_change"] = booking.status in Booking.SEAT_STATUSES and service.policy.is_free_period(booking)
        return Response(data)


class CancelPreviewView(APIView):
    def post(self, request):
        s = LookupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        service = BookingService()
        booking = service.find_by_code(s.validated_data["code"], s.validated_data["email"])
        return Response(service.preview_cancellation(booking))


class CancelMyBookingView(APIView):
    def post(self, request):
        s = LookupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        service = BookingService()
        booking = service.find_by_code(s.validated_data["code"], s.validated_data["email"])
        result = service.cancel(booking.pk, by=Booking.CancelledBy.CLIENT, reason="Скасовано клієнтом")
        result.booking.refresh_from_db()
        return Response(
            {
                "completed": result.completed,
                "refund_amount": result.refund_amount,
                "message": None if result.completed else "Повернення коштів не вдалося. Його опрацює адміністратор.",
                "booking": BookingSerializer(result.booking).data,
            }
        )


class ChangeQuoteView(APIView):
    def post(self, request):
        s = ChangeBookingSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        service = BookingService()
        booking = service.find_by_code(d["code"], d["email"])
        quote = service.quote_change(booking, d["departure_id"], s.group(), d["ski_passes"], d["activities"])
        return Response({**quote["breakdown"].as_dict(), "difference": str(quote["difference"])})


class ChangeMyBookingView(APIView):
    def post(self, request):
        s = ChangeBookingSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        service = BookingService()
        booking = service.find_by_code(d["code"], d["email"])
        r = service.request_change(booking.pk, d["departure_id"], s.group(), d["ski_passes"], d["activities"])
        r.booking.refresh_from_db()
        return Response(
            {
                "applied": r.applied,
                "difference": str(r.difference),
                "checkout_url": r.checkout_url,
                "hold_expires_at": r.change_request.expires_at if not r.applied else None,
                "booking": BookingSerializer(r.booking).data,
            }
        )


# ---------------------------------------------------------------- адміністратор (FR-15)


class AdminBookingViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminBookingSerializer

    def get_queryset(self):
        qs = Booking.objects.select_related("departure__tour__resort").prefetch_related(
            "ski_passes__ski_pass", "activities__activity", "payments", "refunds"
        )
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("departure"):
            qs = qs.filter(departure_id=params["departure"])
        if params.get("q"):
            q = params["q"]
            qs = qs.filter(Q(code__icontains=q) | Q(email__icontains=q) | Q(last_name__icontains=q))
        return qs

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        booking = BookingService().confirm(int(pk))
        return Response(AdminBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Скасування за клієнта (за правилами) або через неможливість підтвердження (full_refund=true)."""
        full_refund = bool(request.data.get("full_refund", False))
        result = BookingService().cancel(
            int(pk),
            by=Booking.CancelledBy.ADMIN,
            reason=request.data.get("reason", ""),
            full_refund=full_refund,
        )
        result.booking.refresh_from_db()
        return Response({"refund_amount": result.refund_amount, "booking": AdminBookingSerializer(result.booking).data})
