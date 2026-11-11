from django.contrib import admin

from .models import Booking, BookingActivity, BookingSkiPass, ChangeRequest, SeatHold


class SkiPassInline(admin.TabularInline):
    model = BookingSkiPass
    extra = 0


class ActivityInline(admin.TabularInline):
    model = BookingActivity
    extra = 0


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["code", "departure", "status", "adults", "children", "infants", "total_amount", "created_at"]
    list_filter = ["status"]
    search_fields = ["code", "email", "last_name"]
    inlines = [SkiPassInline, ActivityInline]


admin.site.register(ChangeRequest)
admin.site.register(SeatHold)
