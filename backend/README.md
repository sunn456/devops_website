# Winterra — серверна частина (Django + DRF + MySQL)

## Запуск (локально, без MySQL)

```bash
cd winterra/backend
python3 -m venv .venv
.venv/bin/pip install "Django>=5.2,<6.0" djangorestframework django-cors-headers
export DB_ENGINE=sqlite
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo        # демо-дані + адміністратор admin / Winterra2026!
.venv/bin/python manage.py runserver
.venv/bin/python manage.py expire_holds --loop   # фонове завдання (в окремому терміналі)
```

## Запуск з MySQL

```sql
CREATE DATABASE winterra CHARACTER SET utf8mb4;
CREATE USER 'winterra'@'localhost' IDENTIFIED BY 'пароль';
GRANT ALL ON winterra.* TO 'winterra'@'localhost';
```
```bash
.venv/bin/pip install -r requirements.txt     # містить mysqlclient (потрібен brew install mysql-client pkg-config)
export DB_PASSWORD=пароль                     # DB_NAME, DB_USER, DB_HOST, DB_PORT — за потреби
.venv/bin/python manage.py migrate
```

## Клієнтська частина (React)

```bash
cd winterra/frontend
npm install
npm run dev          # http://localhost:5173 — запити /api передаються на Django (127.0.0.1:8000)
npm run build        # збірка для розгортання у frontend/dist
```

Сторінки клієнта: пошук → результати → тур → скі-паси й активності → контакти й підсумок → оплата → підтвердження; «Моє бронювання» (скасування, зміна).
Адміністратор: http://localhost:5173/admin (бронювання, місця, платежі, довідники, звіти).

## Тести

```bash
DB_ENGINE=sqlite .venv/bin/python manage.py test
.venv/bin/python manage.py test --noinput     # на MySQL (потрібне право створювати базу test_winterra)
```

Тести `TransactionalApiTests` варто запускати саме на MySQL: SQLite не підтримує `select_for_update`,
тому помилки блокувань поза транзакцією там не проявляються.

## Модулі

| Модуль | Що містить |
|---|---|
| catalog | моделі Resort, Tour, Departure, SkiPass, Activity; пошук виїздів; CRUD довідників |
| bookings | моделі Booking, BookingSkiPass, BookingActivity, SeatHold, ChangeRequest; сервіси BookingService, PriceCalculator, SelectionValidator, SeatService, BookingPolicy |
| payments | моделі Payment, Refund; PaymentService, PaymentGateway, TestPaymentGateway |
| notifications | NotificationService (листи) |
| reports | ReportService (звіти) |
| accounts | вхід/вихід адміністратора (токен) |

Тестові картки: `4242 4242 4242 4242` — успіх, `4000 0000 0000 0002` — відмова.
