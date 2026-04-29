from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import PatientProfile, User


@admin.register(User)
class HMSUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("HMS", {"fields": ("role", "language_preference", "timezone", "phone_number", "is_email_verified")}),
    )
    list_display  = ("id", "email", "username", "role", "phone_number", "is_staff", "is_active")
    list_filter   = ("role", "is_staff", "is_active")
    search_fields = ("email", "username", "first_name", "last_name")


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display  = ("patient_id", "user", "blood_group", "gender", "insurance_provider", "created_at")
    search_fields = ("patient_id", "user__email", "user__first_name")
    list_filter   = ("blood_group", "gender")
