"""Заповнення бази демонстраційними даними: python manage.py seed_demo"""
import json
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from catalog.models import Activity, Departure, Resort, SkiPass, Tour, TourPhoto

RESORTS = [
    ("Буковель", "Україна", "Найбільший гірськолижний курорт України."),
    ("Драгобрат", "Україна", "Найвисокогірніший курорт України зі сніговим сезоном до травня."),
    ("Яблуниця", "Україна", "Затишний курорт на перевалі для сімейного відпочинку."),
    ("Банско", "Болгарія", "Курорт у горах Пірін з довгими трасами."),
]

# По три тури (готелі) на курорт. Готелі реальні; фото — з їхніх галерей на сайті туроператора
# (див. hotel_photos.json і сторінку «Фото та ліцензії»). Кортеж:
# курорт, готель, зірковість, ночей, ціна дорослого, ціна дитини, зсув дня заїзду від суботи, опис.
TOURS = [
    ("Буковель", "Marion Spa Bukovel Hotel", 4, 6, 14500, 9800, 0,
     "Готель у центрі курорту: критий басейн, джакузі з панорамою гір, ресторан і лаунж-бар. Тиждень катання на всіх трасах Буковеля."),
    ("Буковель", "Ribas Karpaty", 4, 3, 7900, 5400, 4,
     "Сучасний готель із басейном і SPA-зоною, світлі номери в мінімалістичному стилі. Короткий виїзд посеред тижня, коли на схилах менше людей."),
    ("Буковель", "Premium Hotel & SPA", 4, 5, 13200, 8900, 1,
     "Відкритий і критий басейни, сауна, ресторан і бар. Удень — схил, увечері — SPA."),
    ("Драгобрат", "Alpin Eco Chalet & Wellness", 3, 5, 10900, 7300, 0,
     "Дерев’яне шале серед засніжених ялин: купіль під відкритим небом з видом на гори, сауна, більярдна й затишні номери в зрубі."),
    ("Драгобрат", "Gremi Hotel", 3, 3, 6900, 4700, 3,
     "Номери в дереві, затишна вітальня, ресторан і тераса з видом на гори. Вікенд на сніжному плато."),
    ("Драгобрат", "Мігалі Драгобрат", 3, 4, 9400, 6300, 5,
     "Готель біля підйомників: вийшов — і одразу на трасу. Дерев’яні номери, увечері — підсвічений схил."),
    ("Яблуниця", "Forest Hill Hotel & SPA", 3, 4, 9900, 6500, 0,
     "Сучасний готель із SPA-комплексом: басейн, сауна, зона відпочинку. Пологі траси для всієї родини поруч."),
    ("Яблуниця", "Вілла Парламент", 3, 6, 12400, 7900, 1,
     "Котеджі в карпатському стилі з деревом у номерах, спільна їдальня й сауна. Тиждень спокійного відпочинку з дітьми."),
    ("Яблуниця", "Gogodz Chalet Resort", 3, 3, 6400, 4200, 4,
     "Сучасні шале з кухнею та вітальнею — для пар і невеликих компаній. Найдоступніший виїзд сезону."),
    ("Банско", "St. George Palace Bansko", 4, 6, 17200, 11400, 0,
     "Великий готель під Піріном: критий басейн під скляним дахом, сауна, бар і просторі номери."),
    ("Банско", "Royal Park & SPA", 4, 4, 12600, 8300, 2,
     "Готель із видом на засніжений Пірін, ресторан і SPA-зона із сауною. Катання й відновлення після трас."),
    ("Банско", "St. George Ski & Holiday", 4, 5, 15100, 9900, 3,
     "Басейн, ресторан і лаунж із каміном; до гондоли на траси — кілька хвилин."),
]

# Попередні назви демо-готелів -> актуальні (виїзди та бронювання зберігаються).
RENAMES = {
    "Radisson Blu Resort Bukovel": "Polyanytsia Grand Hotel", "Grand Hotel Bansko": "Bansko Old Town Hotel",
    "Polyanytsia Grand Hotel": "Marion Spa Bukovel Hotel", "Bukovel Forest Lodge": "Ribas Karpaty",
    "Smereka Spa Resort": "Premium Hotel & SPA", "Dragobrat Mountain Hotel": "Diamant Dragobrat",
    "Svydovets Peak Chalet": "Gremi Hotel", "Bliznytsia Ski Lodge": "Мігалі Драгобрат",
    "Yablunytsia Park Hotel": "Forest Hill Hotel & SPA", "Hutsul Family Resort": "Вілла Парламент",
    "Karpaty Wood Chalet": "Gogodz Chalet Resort", "Bansko Old Town Hotel": "St. George Palace Bansko",
    "Pirin Spa Hotel": "Royal Park & SPA", "Todorka Ski & Spa": "St. George Ski & Holiday",
    "Diamant Dragobrat": "Alpin Eco Chalet & Wellness",
}

# Банер сторінки туру — чіткий зимовий пейзаж курорту (frontend/public/images/banners, Wikimedia Commons).
BANNERS = {
    "Marion Spa Bukovel Hotel": "bukovel-1", "Ribas Karpaty": "bukovel-2", "Premium Hotel & SPA": "bukovel-3",
    "Alpin Eco Chalet & Wellness": "dragobrat-1", "Gremi Hotel": "dragobrat-2", "Мігалі Драгобрат": "dragobrat-3",
    "Forest Hill Hotel & SPA": "yablunytsia-1", "Вілла Парламент": "yablunytsia-2", "Gogodz Chalet Resort": "yablunytsia-3",
    "St. George Palace Bansko": "bansko-1", "Royal Park & SPA": "bansko-2", "St. George Ski & Holiday": "bansko-3",
}

PHOTOS = json.loads((Path(__file__).parent / "hotel_photos.json").read_text(encoding="utf-8"))


def nights_word(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return "ніч"
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return "ночі"
    return "ночей"

SKI_PASS_PRICES = {  # курорт: (дорослий за день, дитячий за день)
    "Буковель": (1400, 900),
    "Драгобрат": (900, 600),
    "Яблуниця": (700, 450),
    "Банско": (1700, 1100),
}


class Command(BaseCommand):
    help = "Створює демонстраційні курорти, тури, виїзди, скі-паси, активності та адміністратора"

    @transaction.atomic
    def handle(self, *args, **options):
        first = self._first_departure_date()
        resorts = {}
        for name, country, descr in RESORTS:
            resorts[name], _ = Resort.objects.get_or_create(name=name, defaults={"country": country, "description": descr})

        for old, new in RENAMES.items():  # порядок важливий: ланцюжок перейменувань
            Tour.objects.filter(hotel_name=old).update(hotel_name=new)

        for name, hotel, stars, nights, adult, child, offset, descr in TOURS:
            gallery = PHOTOS[hotel]["photos"]
            # ключ — курорт і готель: повторний запуск оновлює тур, а не створює дублікат
            tour, _ = Tour.objects.update_or_create(
                resort=resorts[name],
                hotel_name=hotel,
                defaults={
                    "title": f"{name}: {nights} {nights_word(nights)}, {hotel}",
                    "stars": stars,
                    "nights": nights,
                    "description": descr,
                    "adult_price": Decimal(adult),
                    "child_price": Decimal(child),
                    "image_url": gallery[0]["url"],
                    "banner_url": f"/images/banners/{BANNERS[hotel]}.jpg",
                },
            )
            # галерея демо-готелю синхронізується з hotel_photos.json
            if [(p.image_url, p.caption) for p in tour.photos.all()] != [(g["url"], g["caption"]) for g in gallery]:
                tour.photos.all().delete()
                for position, g in enumerate(gallery):
                    TourPhoto.objects.create(tour=tour, image_url=g["url"], caption=g["caption"], position=position)
            for i in range(6):
                start = first + timedelta(days=7 * i + offset)
                Departure.objects.get_or_create(
                    tour=tour, start_date=start, defaults={"end_date": start + timedelta(days=nights), "total_seats": 12}
                )

        for name, resort in resorts.items():
            adult_day, child_day = SKI_PASS_PRICES[name]
            for days in (1, 3, 5):
                for category, per_day in ((SkiPass.Category.ADULT, adult_day), (SkiPass.Category.CHILD, child_day)):
                    SkiPass.objects.get_or_create(
                        resort=resort, category=category, duration_days=days,
                        defaults={"price": Decimal(per_day * days * (Decimal("0.9") if days > 1 else 1)).quantize(Decimal("1"))},
                    )
        for title, price in (("SPA і басейн", 900), ("Екскурсія містом", 600), ("Тюбінг", 400)):
            Activity.objects.get_or_create(title=title, defaults={"price_per_person": Decimal(price)})

        User = get_user_model()
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("admin", "admin@winterra.test", "Winterra2026!")
            self.stdout.write("Адміністратор: admin / Winterra2026!")
        self.stdout.write(self.style.SUCCESS("Демонстраційні дані створено."))

    @staticmethod
    def _first_departure_date() -> date:
        today = timezone.localdate()
        start = today + timedelta(days=14)
        return start + timedelta(days=(5 - start.weekday()) % 7)  # найближча субота
