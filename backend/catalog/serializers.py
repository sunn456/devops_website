from django.utils import timezone
from rest_framework import serializers

from bookings.seats import SeatService

from .models import Activity, Departure, Resort, SkiPass, Tour, TourPhoto


class ResortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resort
        fields = ["id", "name", "country", "description", "is_active"]


class TourSerializer(serializers.ModelSerializer):
    resort_name = serializers.CharField(source="resort.name", read_only=True)

    class Meta:
        model = Tour
        fields = [
            "id", "resort", "resort_name", "title", "hotel_name", "stars", "nights", "description",
            "adult_price", "child_price", "image_url", "banner_url", "is_active",
        ]


class TourPhotoSerializer(serializers.ModelSerializer):
    tour_title = serializers.CharField(source="tour.hotel_name", read_only=True)

    class Meta:
        model = TourPhoto
        fields = ["id", "tour", "tour_title", "image_url", "caption", "position"]


class DepartureSerializer(serializers.ModelSerializer):
    tour_title = serializers.CharField(source="tour.title", read_only=True)
    free_seats = serializers.SerializerMethodField()

    class Meta:
        model = Departure
        fields = ["id", "tour", "tour_title", "start_date", "end_date", "total_seats", "free_seats", "status"]
        read_only_fields = ["status"]

    def get_free_seats(self, obj) -> int:
        return SeatService().free_seats(obj)

    def validate(self, attrs):
        tour = attrs.get("tour") or getattr(self.instance, "tour", None)
        start = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if tour and start and end and (end - start).days != tour.nights:
            raise serializers.ValidationError(f"Тривалість виїзду має дорівнювати {tour.nights} ночам туру.")
        return attrs


class SkiPassSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = SkiPass
        fields = ["id", "resort", "category", "category_display", "duration_days", "price", "is_active"]


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ["id", "resort", "title", "description", "price_per_person", "is_active"]


class TourDetailSerializer(TourSerializer):
    """Сторінка туру (FR-02): склад, ціни, найближчі виїзди, скі-паси та активності курорту."""

    departures = serializers.SerializerMethodField()
    photos = TourPhotoSerializer(many=True, read_only=True)
    ski_passes = serializers.SerializerMethodField()
    activities = serializers.SerializerMethodField()

    class Meta(TourSerializer.Meta):
        fields = TourSerializer.Meta.fields + ["departures", "photos", "ski_passes", "activities"]

    def get_departures(self, tour):
        qs = tour.departures.filter(status=Departure.Status.ACTIVE, start_date__gt=timezone.localdate())
        return DepartureSerializer(qs, many=True).data

    def get_ski_passes(self, tour):
        return SkiPassSerializer(tour.resort.ski_passes.filter(is_active=True), many=True).data

    def get_activities(self, tour):
        qs = Activity.objects.filter(is_active=True).filter(resort__isnull=True) | Activity.objects.filter(
            is_active=True, resort=tour.resort
        )
        return ActivitySerializer(qs.distinct(), many=True).data
