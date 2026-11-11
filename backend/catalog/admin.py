from django.contrib import admin

from .models import Activity, Departure, Resort, SkiPass, Tour, TourPhoto

admin.site.register(Resort)
admin.site.register(Tour)
admin.site.register(TourPhoto)
admin.site.register(Departure)
admin.site.register(SkiPass)
admin.site.register(Activity)
