from django.contrib import admin
from .models import Appointment, Prescription, PrescriptionItem


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 1


class PrescriptionInline(admin.StackedInline):
    model = Prescription
    extra = 0


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ["appointment_ref", "patient", "doctor", "appointment_date", "appointment_time", "status"]
    list_filter = ["status", "appointment_type", "appointment_date"]
    search_fields = ["appointment_ref", "patient__email", "doctor__user__first_name"]
    inlines = [PrescriptionInline]


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ["appointment", "issued_at", "is_dispensed"]
    inlines = [PrescriptionItemInline]
