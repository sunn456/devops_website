from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import LoginView, LogoutView, MeView
from bookings import views as bv
from catalog import views as cv
from payments import views as pv
from reports.views import ReportView

admin_router = DefaultRouter()
admin_router.register("resorts", cv.ResortAdminViewSet)
admin_router.register("tours", cv.TourAdminViewSet)
admin_router.register("tour-photos", cv.TourPhotoAdminViewSet)
admin_router.register("departures", cv.DepartureAdminViewSet)
admin_router.register("ski-passes", cv.SkiPassAdminViewSet)
admin_router.register("activities", cv.ActivityAdminViewSet)
admin_router.register("bookings", bv.AdminBookingViewSet, basename="admin-booking")

api = [
    # каталог і пошук
    path("resorts/", cv.ResortListView.as_view()),
    path("tours/", cv.TourListView.as_view()),
    path("tours/<int:pk>/", cv.TourDetailView.as_view()),
    path("departures/search/", cv.DepartureSearchView.as_view()),
    # оформлення бронювання та оплата
    path("bookings/quote/", bv.QuoteView.as_view()),
    path("bookings/", bv.CreateBookingView.as_view()),
    path("bookings/<uuid:public_id>/", bv.BookingByPublicIdView.as_view()),
    path("bookings/<uuid:public_id>/pay/", bv.RetryPaymentView.as_view()),
    path("payments/webhook/", pv.PaymentWebhookView.as_view()),
    path("test-gateway/charge/", pv.TestGatewayChargeView.as_view()),
    path("test-gateway/<str:provider_ref>/", pv.TestGatewayInfoView.as_view()),
    # «Моє бронювання»
    path("my-booking/", bv.MyBookingView.as_view()),
    path("my-booking/cancel-preview/", bv.CancelPreviewView.as_view()),
    path("my-booking/cancel/", bv.CancelMyBookingView.as_view()),
    path("my-booking/change-quote/", bv.ChangeQuoteView.as_view()),
    path("my-booking/change/", bv.ChangeMyBookingView.as_view()),
    # адміністратор
    path("auth/login/", LoginView.as_view()),
    path("auth/logout/", LogoutView.as_view()),
    path("auth/me/", MeView.as_view()),
    path("admin/payments/", pv.AdminPaymentListView.as_view()),
    path("admin/refunds/", pv.AdminRefundListView.as_view()),
    path("admin/refunds/<int:pk>/retry/", pv.AdminRefundRetryView.as_view()),
    path("admin/reports/", ReportView.as_view()),
    path("admin/", include(admin_router.urls)),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/", include(api)),
]
