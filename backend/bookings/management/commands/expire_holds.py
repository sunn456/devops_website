"""Фонове завдання: зняття прострочених утримань місць.

Запуск щохвилини, наприклад через cron:
    * * * * * cd /srv/winterra/backend && python manage.py expire_holds
або безперервно: python manage.py expire_holds --loop
"""
import time

from django.core.management.base import BaseCommand

from bookings.services import BookingService


class Command(BaseCommand):
    help = "Знімає утримання місць, якщо оплату не завершено за 15 хвилин"

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true", help="виконувати безперервно")
        parser.add_argument("--interval", type=int, default=60, help="інтервал у секундах")

    def handle(self, *args, loop=False, interval=60, **options):
        service = BookingService()
        while True:
            result = service.expire_holds()
            if any(result.values()):
                self.stdout.write(
                    f"Скасовано бронювань: {result['cancelled_bookings']}, "
                    f"прострочено запитів на зміну: {result['expired_changes']}"
                )
            if not loop:
                break
            time.sleep(interval)
