from django.contrib import admin
from .models import Specialty, DoctorProfile


@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin):
    list_display = ["name", "name_ar", "icon"]
    search_fields = ["name"]


@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "specialty", "license_number", "is_active", "is_tele_health_enabled"]
    list_filter = ["specialty", "is_active", "is_tele_health_enabled"]
    search_fields = ["user__first_name", "user__last_name", "license_number"]
