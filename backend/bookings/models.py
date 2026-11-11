"""Модуль bookings: бронювання, їхні позиції, утримання місць і запити на зміну."""
import uuid

from django.core.validators import MinValueValidator
from django.db import models

from catalog.models import MONEY, Activity, Departure, SkiPass


class Booking(models.Model):
    """Бронювання клієнта на певний виїзд."""

    class Status(models.TextChoices):
        NEW = "new", "Нове"                     # створено, місця утримано
        PAID = "paid", "Оплачене"               # платіж отримано, місця закріплено
        CONFIRMED = "confirmed", "Підтверджене"  # перевірено адміністратором
        CANCELLED = "cancelled", "Скасоване"

    class CancelledBy(models.TextChoices):
        CLIENT = "client", "Клієнт"
        ADMIN = "admin", "Адміністратор"
        AGENCY = "agency", "Агенція (скасування виїзду)"
        SYSTEM = "system", "Система (неоплата)"

    # статуси, за яких місця закріплені за бронюванням
    SEAT_STATUSES = (Status.PAID, Status.CONFIRMED)

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    code = models.CharField("Код бронювання", max_length=20, unique=True, null=True, blank=True)
    departure = models.ForeignKey(Departure, on_delete=models.PROTECT, related_name="bookings", verbose_name="Виїзд")
    adults = models.PositiveSmallIntegerField("Дорослі", validators=[MinValueValidator(1)])
    children = models.PositiveSmallIntegerField("Діти", default=0)
    infants = models.PositiveSmallIntegerField("Малюки", default=0)
    first_name = models.CharField("Ім'я", max_length=60)
    last_name = models.CharField("Прізвище", max_length=60)
    phone = models.CharField("Телефон", max_length=20)
    email = models.EmailField("Email")
    total_amount = models.DecimalField("Вартість, грн", **MONEY)
    status = models.CharField("Статус", max_length=10, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField("Створено", auto_now_add=True)
    paid_at = models.DateTimeField("Оплачено", null=True, blank=True)
    confirmed_at = models.DateTimeField("Підтверджено", null=True, blank=True)
    cancelled_at = models.DateTimeField("Скасовано", null=True, blank=True)
    cancelled_by = models.CharField(max_length=10, choices=CancelledBy.choices, blank=True)
    cancel_reason = models.CharField("Причина скасування", max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Бронювання"
        verbose_name_plural = "Бронювання"
        indexes = [models.Index(fields=["status"]), models.Index(fields=["email"])]

    def __str__(self):
        return self.code or f"Бронювання #{self.pk}"

    @property
    def seats(self) -> int:
        """Кількість місць: враховуються дорослі та діти, малюки місця не займають."""
        return self.adults + self.children

    @property
    def participants(self) -> int:
        return self.adults + self.children + self.infants


class BookingSkiPass(models.Model):
    """Скі-пас у складі бронювання (ціна фіксується на момент бронювання)."""

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="ski_passes")
    ski_pass = models.ForeignKey(SkiPass, on_delete=models.PROTECT, related_name="+")
    start_date = models.DateField("Початок дії")
    end_date = models.DateField("Кінець дії")
    quantity = models.PositiveSmallIntegerField("Кількість", validators=[MinValueValidator(1)])
    unit_price = models.DecimalField("Ціна за одиницю", **MONEY)
    line_total = models.DecimalField("Сума", **MONEY)

    class Meta:
        verbose_name = "Скі-пас у бронюванні"
        verbose_name_plural = "Скі-паси у бронюванні"


class BookingActivity(models.Model):
    """Додаткова активність у складі бронювання."""

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="activities")
    activity = models.ForeignKey(Activity, on_delete=models.PROTECT, related_name="+")
    persons = models.PositiveSmallIntegerField("Кількість осіб", validators=[MinValueValidator(1)])
    unit_price = models.DecimalField("Ціна за особу", **MONEY)
    line_total = models.DecimalField("Сума", **MONEY)

    class Meta:
        verbose_name = "Активність у бронюванні"
        verbose_name_plural = "Активності у бронюванні"


class ChangeRequest(models.Model):
    """Запит клієнта на зміну виїзду або складу групи (з доплатою чи поверненням різниці)."""

    class Status(models.TextChoices):
        PENDING = "pending", "Очікує доплати"
        APPLIED = "applied", "Застосовано"
        EXPIRED = "expired", "Прострочено"
        CANCELLED = "cancelled", "Скасовано"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="change_requests")
    new_departure = models.ForeignKey(Departure, on_delete=models.PROTECT, related_name="+")
    adults = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    children = models.PositiveSmallIntegerField(default=0)
    infants = models.PositiveSmallIntegerField(default=0)
    items = models.JSONField("Нові скі-паси та активності", default=dict)
    old_total = models.DecimalField(**MONEY)
    new_total = models.DecimalField(**MONEY)
    difference = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Запит на зміну"
        verbose_name_plural = "Запити на зміну"

    @property
    def seats(self) -> int:
        return self.adults + self.children


class SeatHold(models.Model):
    """Тимчасове утримання місць виїзду на час оплати (15 хвилин)."""

    departure = models.ForeignKey(Departure, on_delete=models.CASCADE, related_name="holds")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="holds")
    change_request = models.ForeignKey(
        ChangeRequest, on_delete=models.CASCADE, related_name="holds", null=True, blank=True
    )
    seats = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Утримання місць"
        verbose_name_plural = "Утримання місць"
        indexes = [models.Index(fields=["is_active", "expires_at"])]
