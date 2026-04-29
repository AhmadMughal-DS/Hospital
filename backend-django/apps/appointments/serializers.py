from rest_framework import serializers
from .models import Appointment, Prescription, PrescriptionItem
from apps.doctors.serializers import DoctorProfileSerializer


class PatientSnapshotSerializer(serializers.Serializer):
    """Inline patient summary attached to appointment — no circular import."""
    id         = serializers.IntegerField()
    full_name  = serializers.CharField()
    email      = serializers.EmailField()
    phone      = serializers.CharField()
    patient_id = serializers.CharField()
    blood_group         = serializers.CharField()
    allergies           = serializers.CharField()
    chronic_conditions  = serializers.CharField()
    gender              = serializers.CharField()
    date_of_birth       = serializers.DateField()


class PrescriptionItemSerializer(serializers.ModelSerializer):
    drug_name_inventory = serializers.CharField(source="drug.name", read_only=True)

    class Meta:
        model = PrescriptionItem
        fields = [
            "id", "drug_name", "drug", "drug_name_inventory",
            "dosage", "frequency", "duration_days",
            "instructions", "quantity", "is_dispensed",
        ]


class PrescriptionSerializer(serializers.ModelSerializer):
    items          = PrescriptionItemSerializer(many=True, read_only=True)
    dispensed_by_name = serializers.CharField(source="dispensed_by.get_full_name", read_only=True)

    class Meta:
        model = Prescription
        fields = [
            "id", "appointment", "notes", "diagnosis",
            "issued_at", "is_dispensed", "dispensed_at",
            "dispensed_by", "dispensed_by_name", "items",
        ]
        read_only_fields = ["id", "issued_at"]


class AppointmentSerializer(serializers.ModelSerializer):
    doctor_detail  = DoctorProfileSerializer(source="doctor", read_only=True)
    patient_name   = serializers.SerializerMethodField()
    patient_detail = serializers.SerializerMethodField()
    prescription   = PrescriptionSerializer(read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id", "appointment_ref",
            "patient", "patient_name", "patient_detail",
            "doctor", "doctor_detail",
            "appointment_date", "appointment_time",
            "duration_minutes", "appointment_type",
            "status", "currency", "fee",
            "chief_complaint", "notes", "diagnosis",
            "follow_up_required", "follow_up_date",
            "tele_room_id", "prescription",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "appointment_ref", "created_at", "updated_at"]

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() or obj.patient.email

    def get_patient_detail(self, obj):
        """Returns inline patient snapshot for Doctor/Admin views."""
        request = self.context.get("request")
        if not request:
            return None
        user = request.user
        if user.role not in ("ADMIN", "DOCTOR", "PHARMACIST"):
            return None  # patients don't see each other's data
        patient = obj.patient
        profile = getattr(patient, "patient_profile", None)
        return {
            "id":         patient.id,
            "full_name":  patient.get_full_name() or patient.email,
            "email":      patient.email,
            "phone":      patient.phone_number,
            "patient_id": profile.patient_id if profile else None,
            "blood_group":        profile.blood_group if profile else "",
            "allergies":          profile.allergies if profile else "",
            "chronic_conditions": profile.chronic_conditions if profile else "",
            "gender":             profile.gender if profile else "",
            "date_of_birth":      str(profile.date_of_birth) if profile and profile.date_of_birth else None,
        }


class AppointmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = [
            "doctor", "appointment_date", "appointment_time",
            "appointment_type", "currency", "chief_complaint",
        ]
        validators = []  # custom validation below

    def validate(self, attrs):
        doctor = attrs["doctor"]
        date   = attrs["appointment_date"]
        time   = attrs["appointment_time"]

        if Appointment.objects.filter(
            doctor=doctor, appointment_date=date, appointment_time=time,
        ).exclude(status=Appointment.Status.CANCELLED).exists():
            raise serializers.ValidationError("This slot is already booked.")

        if attrs.get("appointment_type") == Appointment.Type.TELE_HEALTH and not doctor.is_tele_health_enabled:
            raise serializers.ValidationError("This doctor does not offer tele-health consultations.")

        return attrs

    def create(self, validated_data):
        from apps.billing.models import Invoice, InvoiceItem
        from decimal import Decimal
        import uuid

        doctor   = validated_data["doctor"]
        currency = validated_data.get("currency", "AED")
        fee_map  = {
            "AED": doctor.consultation_fee_aed,
            "SAR": doctor.consultation_fee_sar,
            "EUR": doctor.consultation_fee_eur,
        }
        fee = fee_map.get(currency, doctor.consultation_fee_aed)

        if validated_data.get("appointment_type") == Appointment.Type.TELE_HEALTH:
            discount = Decimal(str(doctor.telehealth_discount_percent)) / Decimal("100")
            fee = (fee * (Decimal("1") - discount)).quantize(Decimal("0.01"))
            validated_data["tele_room_id"] = f"medicore-{uuid.uuid4().hex[:12]}"

        validated_data["fee"]    = fee
        validated_data["patient"] = self.context["request"].user

        appointment = super().create(validated_data)

        # Auto-create pending invoice linked to this appointment
        patient = self.context["request"].user
        invoice = Invoice.objects.create(
            patient=patient,
            appointment=appointment,
            status=Invoice.Status.PENDING,
            currency=currency,
            subtotal=Decimal(str(fee)),
            notes=f"Consultation — {appointment.appointment_ref}",
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            item_type=InvoiceItem.ItemType.CONSULTATION,
            description=f"Consultation with Dr. {doctor.user.get_full_name()} on {appointment.appointment_date}",
            quantity=1,
            unit_price=Decimal(str(fee)),
        )

        return appointment


class AppointmentClinicalUpdateSerializer(serializers.ModelSerializer):
    """Doctor updates clinical fields only — patient sees these immediately."""
    class Meta:
        model = Appointment
        fields = [
            "status", "diagnosis", "notes", "chief_complaint",
            "follow_up_required", "follow_up_date",
        ]
