from django.contrib import admin
from .models import QueueToken


@admin.register(QueueToken)
class QueueTokenAdmin(admin.ModelAdmin):
    list_display = ["token_number", "token_ref", "patient_display", "doctor", "queue_date", "status", "is_priority"]
    list_filter = ["status", "queue_date", "is_priority"]
    search_fields = ["token_ref", "patient__email", "patient_name"]

    def patient_display(self, obj):
        if obj.patient:
            return obj.patient.email
        return obj.patient_name or "Walk-in"
    patient_display.short_description = "Patient"
