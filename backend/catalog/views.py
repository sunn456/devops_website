from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.pricing import GroupComposition, PriceCalculator
from bookings.seats import SeatService
from bookings.services import BookingService

from .models import Activity, Departure, Resort, SkiPass, Tour, TourPhoto
from .serializers import (
    ActivitySerializer,
    DepartureSerializer,
    ResortSerializer,
    SkiPassSerializer,
    TourDetailSerializer,
    TourPhotoSerializer,
    TourSerializer,
)

# ---------------------------------------------------------------- публічна частина


class ResortListView(generics.ListAPIView):
    queryset = Resort.objects.filter(is_active=True)
    serializer_class = ResortSerializer


class TourListView(APIView):
    """Каталог готелів для головної сторінки: активні тури з найближчою датою виїзду."""

    def get(self, request):
        today = timezone.localdate()
        rows = []
        for tour in Tour.objects.filter(is_active=True, resort__is_active=True).select_related("resort"):
            nearest = tour.departures.filter(status=Departure.Status.ACTIVE, start_date__gt=today).order_by("start_date").first()
            if nearest is None:
                continue
            rows.append(TourSerializer(tour).data | {"next_departure": DepartureSerializer(nearest).data})
        return Response(rows)


class TourDetailView(generics.RetrieveAPIView):
    queryset = Tour.objects.filter(is_active=True).select_related("resort")
    serializer_class = TourDetailSerializer


class SearchParamsSerializer(serializers.Serializer):
    resort = serializers.IntegerField()
    date = serializers.DateField()
    adults = serializers.IntegerField(min_value=1)
    children = serializers.IntegerField(min_value=0, default=0)
    infants = serializers.IntegerField(min_value=0, default=0)
    window_days = serializers.IntegerField(min_value=0, max_value=30, default=7)


class DepartureSearchView(APIView):
    """FR-01: пошук виїздів за курортом, датою заїзду та складом групи."""

    def get(self, request):
        params = SearchParamsSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        p = params.validated_data
        group = GroupComposition(p["adults"], p["children"], p["infants"])
        date_from = max(p["date"], timezone.localdate() + timedelta(days=1))
        qs = Departure.objects.select_related("tour__resort").filter(
            status=Departure.Status.ACTIVE,
            tour__is_active=True,
            tour__resort_id=p["resort"],
            start_date__range=(date_from, p["date"] + timedelta(days=p["window_days"])),
        )
        seats, calc = SeatService(), PriceCalculator()
        results = []
        for dep in qs:
            free = seats.free_seats(dep)
            if free < group.seats:
                continue
            results.append(
                {
                    "departure": DepartureSerializer(dep).data | {"free_seats": free},
                    "tour": TourSerializer(dep.tour).data,
                    "group_price": str(calc.calculate(dep, group).total),
                }
            )
        return Response({"results": results, "message": None if results else "Вільних місць немає. Спробуйте іншу дату або склад групи."})


# ---------------------------------------------------------------- адміністративна частина (FR-14)


class AdminViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]


class ResortAdminViewSet(AdminViewSet):
    queryset = Resort.objects.all()
    serializer_class = ResortSerializer


class TourAdminViewSet(AdminViewSet):
    queryset = Tour.objects.select_related("resort")
    serializer_class = TourSerializer


class SkiPassAdminViewSet(AdminViewSet):
    queryset = SkiPass.objects.select_related("resort")
    serializer_class = SkiPassSerializer


class ActivityAdminViewSet(AdminViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer


class TourPhotoAdminViewSet(AdminViewSet):
    queryset = TourPhoto.objects.select_related("tour")
    serializer_class = TourPhotoSerializer


class DepartureAdminViewSet(AdminViewSet):
    queryset = Departure.objects.select_related("tour")
    serializer_class = DepartureSerializer

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        results = BookingService().cancel_departure(int(pk), request.data.get("reason", ""))
        return Response(
            {
                "cancelled_bookings": len(results),
                "refunded": str(sum((r.refund_amount for r in results), 0)),
                "failed_refunds": sum(1 for r in results for f in r.refunds if f.status == "failed"),
            }
        )

    @action(detail=False, methods=["get"])
    def availability(self, request):
        """FR-16: відомість наявності місць по виїздах."""
        seats = SeatService()
        rows = []
        for dep in self.get_queryset().filter(start_date__gte=timezone.localdate()):
            occupied = seats.occupied_seats(dep)
            rows.append(
                {
                    "id": dep.pk,
                    "tour": dep.tour.title,
                    "start_date": dep.start_date,
                    "status": dep.status,
                    "total": dep.total_seats,
                    "occupied": occupied,
                    "free": max(dep.total_seats - occupied, 0),
                }
            )
        return Response(rows)
