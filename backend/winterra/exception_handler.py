"""Перетворення помилок бізнес-логіки на зрозумілі HTTP-відповіді REST API."""
from django.db.models import ProtectedError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from bookings.exceptions import BookingError


def exception_handler(exc, context):
    if isinstance(exc, BookingError):
        return Response({"detail": exc.message, "code": exc.code}, status=exc.status_code)
    if isinstance(exc, ProtectedError):
        return Response(
            {
                "detail": "Запис використовується в інших даних і не може бути видалений.",
                "code": "protected",
            },
            status=409,
        )
    return drf_exception_handler(exc, context)
