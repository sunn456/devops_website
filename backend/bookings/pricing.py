"""Розрахунок вартості бронювання та перевірка вибору клієнта.

Вартість = дорослі × ціна дорослого + діти × ціна дитини + скі-паси + активності.
Малюки проживають безкоштовно. Суми округлюються до двох знаків (вимога 2.2).
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from catalog.models import Activity, Departure, SkiPass

from .exceptions import ValidationFailed

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def money(value) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class GroupComposition:
    """Склад групи за віковими категоріями (вік визначається на дату заїзду)."""

    adults: int
    children: int = 0
    infants: int = 0

    @property
    def seats(self) -> int:
        return self.adults + self.children

    @property
    def participants(self) -> int:
        return self.adults + self.children + self.infants


@dataclass(frozen=True)
class SkiPassSelection:
    ski_pass: SkiPass
    start_date: date
    quantity: int

    @property
    def end_date(self) -> date:
        return self.start_date + timedelta(days=self.ski_pass.duration_days - 1)


@dataclass(frozen=True)
class ActivitySelection:
    activity: Activity
    persons: int


@dataclass(frozen=True)
class PriceLine:
    kind: str
    title: str
    quantity: int
    unit_price: Decimal

    @property
    def total(self) -> Decimal:
        return money(self.unit_price * self.quantity)


@dataclass
class PriceBreakdown:
    """Підсумок замовлення: перелік позицій і загальна сума."""

    lines: list[PriceLine] = field(default_factory=list)

    @property
    def total(self) -> Decimal:
        return money(sum((line.total for line in self.lines), ZERO))

    def as_dict(self) -> dict:
        return {
            "lines": [
                {
                    "kind": line.kind,
                    "title": line.title,
                    "quantity": line.quantity,
                    "unit_price": str(money(line.unit_price)),
                    "total": str(line.total),
                }
                for line in self.lines
            ],
            "total": str(self.total),
        }


class SelectionValidator:
    """Перевіряє виїзд, склад групи, скі-паси та активності перед розрахунком."""

    def validate(
        self,
        departure: Departure,
        group: GroupComposition,
        ski_passes: list[SkiPassSelection],
        activities: list[ActivitySelection],
        today: date | None = None,
    ) -> None:
        today = today or timezone.localdate()
        self._validate_departure(departure, today)
        self._validate_group(group)
        self._validate_ski_passes(departure, group, ski_passes)
        self._validate_activities(departure, group, activities)

    @staticmethod
    def _validate_departure(departure: Departure, today: date) -> None:
        if not departure.is_active or not departure.tour.is_active:
            raise ValidationFailed("Цей виїзд недоступний для бронювання.")
        if departure.start_date <= today:
            raise ValidationFailed("Бронювання на цей виїзд уже закрите.")

    @staticmethod
    def _validate_group(group: GroupComposition) -> None:
        if group.adults < 1:
            raise ValidationFailed("У групі має бути щонайменше один дорослий.")
        if group.children < 0 or group.infants < 0:
            raise ValidationFailed("Кількість учасників не може бути від'ємною.")
        if group.infants > group.adults:
            raise ValidationFailed("Кожного малюка має супроводжувати дорослий.")

    @staticmethod
    def _validate_ski_passes(departure, group, ski_passes) -> None:
        resort_id = departure.tour.resort_id
        coverage: dict[tuple[str, date], int] = defaultdict(int)
        for sel in ski_passes:
            ski_pass = sel.ski_pass
            if sel.quantity < 1:
                raise ValidationFailed("Кількість скі-пасів має бути не меншою за 1.")
            if ski_pass.resort_id != resort_id or not ski_pass.is_active:
                raise ValidationFailed("Обраний скі-пас не належить курорту туру.")
            if not departure.contains_period(sel.start_date, sel.end_date):
                raise ValidationFailed(
                    f"Період дії скі-паса ({sel.start_date:%d.%m}–{sel.end_date:%d.%m}) виходить за межі "
                    f"перебування ({departure.start_date:%d.%m}–{departure.end_date:%d.%m}).",
                    code="ski_pass_out_of_stay",
                )
            day = sel.start_date
            while day <= sel.end_date:
                coverage[(ski_pass.category, day)] += sel.quantity
                day += timedelta(days=1)

        # на кожен день скі-пасів категорії не більше, ніж учасників цієї категорії;
        # малюкам скі-паси не оформлюються
        limits = {SkiPass.Category.ADULT: group.adults, SkiPass.Category.CHILD: group.children}
        for (category, day), count in coverage.items():
            if count > limits[category]:
                who = "дорослих" if category == SkiPass.Category.ADULT else "дітей"
                raise ValidationFailed(f"На {day:%d.%m} обрано більше скі-пасів, ніж {who} у групі.")

    @staticmethod
    def _validate_activities(departure, group, activities) -> None:
        resort_id = departure.tour.resort_id
        for sel in activities:
            if not sel.activity.is_available_at(resort_id):
                raise ValidationFailed(f"Активність «{sel.activity.title}» недоступна на цьому курорті.")
            if not 1 <= sel.persons <= group.participants:
                raise ValidationFailed(
                    f"Кількість осіб для «{sel.activity.title}» має бути від 1 до {group.participants}."
                )


class PriceCalculator:
    """Розраховує вартість бронювання за моделлю з розділу 2."""

    def calculate(
        self,
        departure: Departure,
        group: GroupComposition,
        ski_passes: list[SkiPassSelection] = (),
        activities: list[ActivitySelection] = (),
    ) -> PriceBreakdown:
        tour = departure.tour
        lines = [PriceLine("tour_adult", f"Тур «{tour.title}» — дорослий", group.adults, tour.adult_price)]
        if group.children:
            lines.append(PriceLine("tour_child", f"Тур «{tour.title}» — дитина 4–11", group.children, tour.child_price))
        if group.infants:
            lines.append(PriceLine("tour_infant", "Малюк 0–3 (без окремого місця)", group.infants, ZERO))
        for sel in ski_passes:
            sp = sel.ski_pass
            lines.append(
                PriceLine(
                    "ski_pass",
                    f"Скі-пас {sp.get_category_display().lower()}, {sp.duration_days} дн. з {sel.start_date:%d.%m}",
                    sel.quantity,
                    sp.price,
                )
            )
        for sel in activities:
            lines.append(PriceLine("activity", sel.activity.title, sel.persons, sel.activity.price_per_person))
        return PriceBreakdown(lines)
