from rest_framework import serializers
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import ReportService


class ReportParamsSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["bookings", "revenue", "tours", "resorts"])
    date_from = serializers.DateField()
    date_to = serializers.DateField()

    def validate(self, attrs):
        if attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError("Початок періоду має бути не пізніше кінця.")
        return attrs


class ReportView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        s = ReportParamsSerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        service = ReportService()
        handlers = {
            "bookings": service.bookings_summary,
            "revenue": service.revenue,
            "tours": service.popular_tours,
            "resorts": service.popular_resorts,
        }
        return Response({"type": d["type"], "data": handlers[d["type"]](d["date_from"], d["date_to"])})
