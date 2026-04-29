from rest_framework import serializers
from .models import Specialty, DoctorProfile
from apps.accounts.models import User


class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = ["id", "name", "name_ar", "icon", "description", "is_active"]


class DoctorUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email", "phone_number"]


class DoctorProfileSerializer(serializers.ModelSerializer):
    user          = DoctorUserSerializer(read_only=True)
    specialty     = SpecialtySerializer(read_only=True)
    specialty_id  = serializers.PrimaryKeyRelatedField(
        queryset=Specialty.objects.all(), source="specialty", write_only=True, required=False
    )
    full_name     = serializers.SerializerMethodField()
    working_days_list = serializers.ListField(read_only=True)

    class Meta:
        model = DoctorProfile
        fields = [
            "id", "user", "full_name",
            "specialty", "specialty_id",
            "department", "license_number",
            "bio", "bio_ar", "education", "experience_years", "languages_spoken",
            "consultation_fee_aed", "consultation_fee_sar", "consultation_fee_eur",
            "available_from", "available_to", "slot_duration_minutes",
            "working_days", "working_days_list",
            "is_tele_health_enabled", "telehealth_discount_percent",
            "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_full_name(self, obj):
        return f"Dr. {obj.user.get_full_name()}"
