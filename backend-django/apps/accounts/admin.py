from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import PatientProfile, User


@admin.register(User)
class HMSUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("HMS", {"fields": ("role", "language_preference", "timezone")}),)
    list_display = ("id", "email", "username", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ("patient_id", "user", "phone_number", "created_at")
    search_fields = ("patient_id", "user__email", "user__username")
