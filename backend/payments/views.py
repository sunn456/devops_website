from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.exceptions import BookingError
from bookings.serializers import PaymentSerializer, RefundSerializer
from bookings.services import BookingService

from .gateway import TestPaymentGateway
from .models import Payment, Refund
from .services import PaymentService


@transaction.atomic
def process_gateway_message(body: bytes, signature: str) -> Payment:
    """Оновлення платежу та обробка його результату виконуються в одній транзакції
    (рядок платежу блокується select_for_update — захист від повторних повідомлень)."""
    service = BookingService()
    payment, changed = service.payments.handle_webhook(body, signature)
    if changed:
        service.on_payment_result(payment)
    return payment


class PaymentWebhookView(APIView):
    """Повідомлення платіжного сервісу про результат оплати (з підписом)."""

    authentication_classes = []

    def post(self, request):
        payment = process_gateway_message(request.body, request.headers.get("X-Signature", ""))
        return Response({"status": payment.status})


# ---------------------------------------------------------------- тестовий платіжний сервіс


class TestGatewayInfoView(APIView):
    """Дані для сторінки оплати тестового сервісу."""

    def get(self, request, provider_ref):
        payment = get_object_or_404(Payment.objects.select_related("booking"), provider_ref=provider_ref)
        return Response(
            {
                "amount": payment.amount,
                "kind": payment.get_kind_display(),
                "status": payment.status,
                "booking_public_id": payment.booking.public_id,
            }
        )


class ChargeSerializer(serializers.Serializer):
    provider_ref = serializers.CharField()
    card_number = serializers.CharField()
    expiry = serializers.RegexField(r"^(0[1-9]|1[0-2])/\d{2}$")
    cvv = serializers.RegexField(r"^\d{3}$")


class TestGatewayChargeView(APIView):
    """Імітація сторінки оплати: дані картки лише перевіряються й ніде не зберігаються."""

    def post(self, request):
        s = ChargeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        gateway = PaymentService().gateway
        if not isinstance(gateway, TestPaymentGateway):
            raise BookingError("Тестова оплата вимкнена.")
        body, signature = gateway.charge(s.validated_data["provider_ref"], s.validated_data["card_number"])
        payment = process_gateway_message(body, signature)
        return Response({"status": payment.status, "booking_public_id": payment.booking.public_id})


# ---------------------------------------------------------------- адміністратор (FR-16)


class AdminPaymentListView(ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related("booking")
        if s := self.request.query_params.get("status"):
            qs = qs.filter(status=s)
        return qs


class AdminRefundListView(ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = RefundSerializer

    def get_queryset(self):
        qs = Refund.objects.select_related("booking")
        if s := self.request.query_params.get("status"):
            qs = qs.filter(status=s)
        return qs


class AdminRefundRetryView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        refund = BookingService().retry_refund(pk)
        return Response(RefundSerializer(refund).data)
