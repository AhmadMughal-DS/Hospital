from rest_framework import serializers
from .models import QueueToken
from django.utils import timezone


class QueueTokenSerializer(serializers.ModelSerializer):
    patient_display = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = QueueToken
        fields = [
            "id", "token_number", "token_ref",
            "patient", "patient_name", "patient_display",
            "doctor", "doctor_name",
            "queue_date", "status", "is_priority",
            "called_at", "completed_at",
            "estimated_wait_minutes", "created_at",
        ]
        read_only_fields = ["id", "token_number", "token_ref", "created_at"]

    def get_patient_display(self, obj):
        if obj.patient:
            return obj.patient.get_full_name() or obj.patient.email
        return obj.patient_name or "Walk-in"

    def get_doctor_name(self, obj):
        if obj.doctor:
            return f"Dr. {obj.doctor.user.get_full_name()}"
        return "General"


class QueueTokenCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QueueToken
        fields = ["patient", "patient_name", "doctor", "is_priority"]

    def create(self, validated_data):
        today = timezone.now().date()
        # Auto-assign next token number for today
        last_token = QueueToken.objects.filter(queue_date=today).order_by("-token_number").first()
        next_number = (last_token.token_number + 1) if last_token else 1
        validated_data["queue_date"] = today
        validated_data["token_number"] = next_number
        return super().create(validated_data)
