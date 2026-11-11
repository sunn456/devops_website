"""Модуль notifications: листи клієнтам через поштовий сервіс (SMTP)."""
import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


class NotificationService:
    def send_booking_code(self, booking) -> None:
        dep = booking.departure
        body = (
            f"Вітаємо, {booking.first_name}!\n\n"
            f"Оплату отримано. Код вашого бронювання: {booking.code}\n"
            f"Тур: {dep.tour.title} ({dep.tour.resort.name})\n"
            f"Заїзд: {dep.start_date:%d.%m.%Y}, виїзд: {dep.end_date:%d.%m.%Y}\n"
            f"Учасники: дорослі — {booking.adults}, діти — {booking.children}, малюки — {booking.infants}\n"
            f"Сума: {booking.total_amount} грн\n\n"
            f"Знайти, змінити чи скасувати бронювання можна за кодом і email на сторінці «Моє бронювання».\n"
            f"Повне повернення коштів — при скасуванні не пізніше ніж за 7 днів до заїзду."
        )
        self._send(booking.email, f"Winterra: бронювання {booking.code}", body)

    def send_cancellation(self, booking) -> None:
        body = (
            f"Бронювання {booking.code or ''} скасовано.\n"
            f"Причина: {booking.cancel_reason or booking.get_cancelled_by_display()}\n"
            "Якщо передбачено повернення коштів, воно надійде на картку, з якої здійснено оплату."
        )
        self._send(booking.email, f"Winterra: бронювання {booking.code or ''} скасовано", body)

    def send_change_applied(self, booking) -> None:
        dep = booking.departure
        body = (
            f"Бронювання {booking.code} змінено.\n"
            f"Заїзд: {dep.start_date:%d.%m.%Y}, учасники: {booking.adults} дор., {booking.children} діт., "
            f"{booking.infants} мал.\nНова вартість: {booking.total_amount} грн"
        )
        self._send(booking.email, f"Winterra: бронювання {booking.code} змінено", body)

    @staticmethod
    def _send(to: str, subject: str, body: str) -> None:
        try:
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to])
        except Exception:  # збій пошти не повинен зривати бронювання
            logger.exception("Не вдалося надіслати лист на %s", to)
