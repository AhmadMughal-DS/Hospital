from rest_framework import serializers
from .models import Appointment, Prescription, PrescriptionItem
from apps.doctors.serializers import DoctorProfileSerializer
from apps.accounts.serializers import UserSerializer


class PrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = ["id", "drug_name", "dosage", "frequency", "duration_days", "instructions", "quantity"]


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True, read_only=True)

    class Meta:
        model = Prescription
        fields = ["id", "appointment", "notes", "issued_at", "is_dispensed", "items"]
        read_only_fields = ["id", "issued_at"]


class AppointmentSerializer(serializers.ModelSerializer):
    doctor_detail = DoctorProfileSerializer(source="doctor", read_only=True)
    patient_name = serializers.SerializerMethodField()
    prescription = PrescriptionSerializer(read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id", "appointment_ref", "patient", "doctor", "doctor_detail",
            "patient_name", "appointment_date", "appointment_time",
            "duration_minutes", "appointment_type", "status", "currency",
            "fee", "chief_complaint", "notes", "tele_room_id",
            "prescription", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "appointment_ref", "created_at", "updated_at"]

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() or obj.patient.email


class AppointmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = [
            "doctor", "appointment_date", "appointment_time",
            "appointment_type", "currency", "chief_complaint",
        ]

    def validate(self, attrs):
        doctor = attrs["doctor"]
        date = attrs["appointment_date"]
        time = attrs["appointment_time"]
        if Appointment.objects.filter(
            doctor=doctor,
            appointment_date=date,
            appointment_time=time,
        ).exclude(status=Appointment.Status.CANCELLED).exists():
            raise serializers.ValidationError("This slot is already booked.")
        return attrs

    def create(self, validated_data):
        doctor = validated_data["doctor"]
        currency = validated_data.get("currency", "AED")
        fee_map = {
            "AED": doctor.consultation_fee_aed,
            "SAR": doctor.consultation_fee_sar,
            "EUR": doctor.consultation_fee_eur,
        }
        validated_data["fee"] = fee_map.get(currency, doctor.consultation_fee_aed)
        validated_data["patient"] = self.context["request"].user
        return super().create(validated_data)
