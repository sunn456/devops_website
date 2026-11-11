"""Модуль catalog: довідники курортів, турів, виїздів, скі-пасів і активностей."""
from datetime import date

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

MONEY = {"max_digits": 10, "decimal_places": 2, "validators": [MinValueValidator(0)]}


class Resort(models.Model):
    """Курорт (Буковель, Драгобрат, Яблуниця, Банско)."""

    name = models.CharField("Назва", max_length=100, unique=True)
    country = models.CharField("Країна", max_length=60)
    description = models.TextField("Опис", blank=True)
    is_active = models.BooleanField("Активний", default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Курорт"
        verbose_name_plural = "Курорти"

    def __str__(self):
        return self.name


class Tour(models.Model):
    """Тур: проживання в готелі зі сніданками на фіксовану кількість ночей.

    Ціна задається за людину: повна — для дорослих (від 12 років),
    дитяча — для дітей 4–11 років; малюки 0–3 роки проживають безкоштовно.
    """

    resort = models.ForeignKey(Resort, on_delete=models.PROTECT, related_name="tours", verbose_name="Курорт")
    title = models.CharField("Назва туру", max_length=150)
    hotel_name = models.CharField("Готель", max_length=150)
    stars = models.PositiveSmallIntegerField("Зірковість готелю", default=4, validators=[MinValueValidator(1), MaxValueValidator(5)])
    nights = models.PositiveSmallIntegerField("Кількість ночей", validators=[MinValueValidator(1)])
    description = models.TextField("Опис", blank=True)
    adult_price = models.DecimalField("Ціна для дорослого, грн", **MONEY)
    child_price = models.DecimalField("Ціна для дитини, грн", **MONEY)
    image_url = models.CharField("Зображення (URL або шлях /images/...)", max_length=300, blank=True)
    banner_url = models.CharField("Фото банера сторінки туру (зимовий пейзаж)", max_length=300, blank=True)
    is_active = models.BooleanField("Активний", default=True)

    class Meta:
        ordering = ["resort__name", "title"]
        verbose_name = "Тур"
        verbose_name_plural = "Тури"

    def __str__(self):
        return f"{self.title} ({self.resort})"


class TourPhoto(models.Model):
    """Фото готелю туру для галереї на сторінці туру (фасад, номер, басейн, ресторан тощо)."""

    tour = models.ForeignKey(Tour, on_delete=models.CASCADE, related_name="photos", verbose_name="Тур")
    image_url = models.CharField("Зображення (URL або шлях /images/...)", max_length=300)
    caption = models.CharField("Підпис", max_length=120, blank=True)
    position = models.PositiveSmallIntegerField("Порядок", default=0)

    class Meta:
        ordering = ["tour", "position", "id"]
        verbose_name = "Фото туру"
        verbose_name_plural = "Фото турів"

    def __str__(self):
        return f"{self.tour.hotel_name}: {self.caption or self.image_url}"


class Departure(models.Model):
    """Виїзд — запланована дата проведення туру з обмеженою кількістю місць."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Активний"
        CANCELLED = "cancelled", "Скасований агенцією"

    tour = models.ForeignKey(Tour, on_delete=models.PROTECT, related_name="departures", verbose_name="Тур")
    start_date = models.DateField("Дата заїзду")
    end_date = models.DateField("Дата виїзду")
    total_seats = models.PositiveIntegerField("Кількість місць", validators=[MinValueValidator(1)])
    status = models.CharField("Статус", max_length=10, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        ordering = ["start_date"]
        verbose_name = "Виїзд"
        verbose_name_plural = "Виїзди"
        constraints = [
            models.CheckConstraint(condition=Q(end_date__gt=F("start_date")), name="departure_dates_valid"),
            models.UniqueConstraint(fields=["tour", "start_date"], name="departure_unique_tour_start"),
        ]

    def __str__(self):
        return f"{self.tour.title}: {self.start_date:%d.%m.%Y}–{self.end_date:%d.%m.%Y}"

    def clean(self):
        if self.start_date and self.end_date and self.tour_id:
            if (self.end_date - self.start_date).days != self.tour.nights:
                raise ValidationError(
                    f"Тривалість виїзду має дорівнювати кількості ночей туру ({self.tour.nights})."
                )

    def contains_period(self, start: date, end: date) -> bool:
        """Чи лежить період [start; end] у межах перебування за туром."""
        return self.start_date <= start and end <= self.end_date

    @property
    def is_active(self) -> bool:
        return self.status == self.Status.ACTIVE


class SkiPass(models.Model):
    """Скі-пас курорту: категорія, тривалість у днях і ціна."""

    class Category(models.TextChoices):
        ADULT = "adult", "Дорослий"
        CHILD = "child", "Дитячий"

    resort = models.ForeignKey(Resort, on_delete=models.PROTECT, related_name="ski_passes", verbose_name="Курорт")
    category = models.CharField("Категорія", max_length=10, choices=Category.choices)
    duration_days = models.PositiveSmallIntegerField("Тривалість, днів", validators=[MinValueValidator(1)])
    price = models.DecimalField("Ціна, грн", **MONEY)
    is_active = models.BooleanField("Активний", default=True)

    class Meta:
        ordering = ["resort__name", "category", "duration_days"]
        verbose_name = "Скі-пас"
        verbose_name_plural = "Скі-паси"
        constraints = [
            models.UniqueConstraint(
                fields=["resort", "category", "duration_days"], name="skipass_unique_resort_category_days"
            ),
        ]

    def __str__(self):
        return f"{self.resort}: {self.get_category_display()}, {self.duration_days} дн."


class Activity(models.Model):
    """Додаткова активність для тих, хто не катається (SPA, екскурсія, тюбінг).

    Якщо курорт не вказано, активність доступна на всіх курортах.
    """

    resort = models.ForeignKey(
        Resort, on_delete=models.PROTECT, related_name="activities", null=True, blank=True, verbose_name="Курорт"
    )
    title = models.CharField("Назва", max_length=120)
    description = models.TextField("Опис", blank=True)
    price_per_person = models.DecimalField("Ціна за особу, грн", **MONEY)
    is_active = models.BooleanField("Активна", default=True)

    class Meta:
        ordering = ["title"]
        verbose_name = "Активність"
        verbose_name_plural = "Активності"

    def __str__(self):
        return self.title

    def is_available_at(self, resort_id: int) -> bool:
        return self.is_active and (self.resort_id is None or self.resort_id == resort_id)
