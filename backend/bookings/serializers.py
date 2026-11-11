from rest_framework import serializers

from payments.models import Payment, Refund

from .models import Booking, BookingActivity, BookingSkiPass
from .pricing import GroupComposition

PHONE_REGEX = r"^\+?[0-9\s\-()]{10,20}$"


class SkiPassItemSerializer(serializers.Serializer):
    ski_pass_id = serializers.IntegerField()
    start_date = serializers.DateField()
    quantity = serializers.IntegerField(min_value=1)


class ActivityItemSerializer(serializers.Serializer):
    activity_id = serializers.IntegerField()
    persons = serializers.IntegerField(min_value=1)


class SelectionSerializer(serializers.Serializer):
    """Вибір клієнта: виїзд, склад групи, скі-паси та активності."""

    departure_id = serializers.IntegerField()
    adults = serializers.IntegerField(min_value=1)
    children = serializers.IntegerField(min_value=0, default=0)
    infants = serializers.IntegerField(min_value=0, default=0)
    ski_passes = SkiPassItemSerializer(many=True, required=False, default=list)
    activities = ActivityItemSerializer(many=True, required=False, default=list)

    def group(self) -> GroupComposition:
        d = self.validated_data
        return GroupComposition(d["adults"], d["children"], d["infants"])


class CreateBookingSerializer(SelectionSerializer):
    first_name = serializers.CharField(max_length=60)
    last_name = serializers.CharField(max_length=60)
    phone = serializers.RegexField(PHONE_REGEX, error_messages={"invalid": "Некоректний номер телефону."})
    email = serializers.EmailField()

    def contact(self) -> dict:
        return {k: self.validated_data[k] for k in ("first_name", "last_name", "phone", "email")}


class LookupSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20)
    email = serializers.EmailField()


class ChangeBookingSerializer(LookupSerializer, SelectionSerializer):
    pass


class BookingSkiPassSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source="ski_pass.__str__", read_only=True)

    class Meta:
        model = BookingSkiPass
        fields = ["ski_pass", "title", "start_date", "end_date", "quantity", "unit_price", "line_total"]


class BookingActivitySerializer(serializers.ModelSerializer):
    title = serializers.CharField(source="activity.title", read_only=True)

    class Meta:
        model = BookingActivity
        fields = ["activity", "title", "persons", "unit_price", "line_total"]


class BookingSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tour = serializers.CharField(source="departure.tour.title", read_only=True)
    tour_id = serializers.IntegerField(source="departure.tour_id", read_only=True)
    resort = serializers.CharField(source="departure.tour.resort.name", read_only=True)
    hotel_name = serializers.CharField(source="departure.tour.hotel_name", read_only=True)
    tour_image = serializers.CharField(source="departure.tour.image_url", read_only=True)
    tour_banner = serializers.CharField(source="departure.tour.banner_url", read_only=True)
    start_date = serializers.DateField(source="departure.start_date", read_only=True)
    end_date = serializers.DateField(source="departure.end_date", read_only=True)
    ski_passes = BookingSkiPassSerializer(many=True, read_only=True)
    activities = BookingActivitySerializer(many=True, read_only=True)
    hold_expires_at = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "public_id", "code", "status", "status_display", "departure", "tour", "tour_id", "resort", "hotel_name", "tour_image", "tour_banner", "start_date",
            "end_date", "adults", "children", "infants", "first_name", "last_name", "phone", "email",
            "total_amount", "ski_passes", "activities", "hold_expires_at", "created_at", "paid_at",
            "confirmed_at", "cancelled_at", "cancel_reason",
        ]

    def get_hold_expires_at(self, booking):
        if booking.status != Booking.Status.NEW:
            return None
        hold = booking.holds.filter(is_active=True, change_request__isnull=True).first()
        return hold.expires_at if hold else None


class PaymentSerializer(serializers.ModelSerializer):
    booking_code = serializers.CharField(source="booking.code", read_only=True)

    class Meta:
        model = Payment
        fields = ["id", "booking", "booking_code", "kind", "amount", "status", "provider_ref", "created_at", "paid_at"]


class RefundSerializer(serializers.ModelSerializer):
    booking_code = serializers.CharField(source="booking.code", read_only=True)

    class Meta:
        model = Refund
        fields = [
            "id", "booking", "booking_code", "payment", "amount", "reason", "status",
            "error_message", "created_at", "processed_at",
        ]


class AdminBookingSerializer(BookingSerializer):
    payments = PaymentSerializer(many=True, read_only=True)
    refunds = RefundSerializer(many=True, read_only=True)

    class Meta(BookingSerializer.Meta):
        fields = ["id"] + BookingSerializer.Meta.fields + ["cancelled_by", "payments", "refunds"]
