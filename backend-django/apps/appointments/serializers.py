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
        # Disable auto-generated unique_together validator — we handle it
        # manually in validate() with a user-friendly error message.
        validators = []

    def validate(self, attrs):
        doctor = attrs["doctor"]
        date = attrs["appointment_date"]
        time = attrs["appointment_time"]

        # Check slot conflict
        if Appointment.objects.filter(
            doctor=doctor,
            appointment_date=date,
            appointment_time=time,
        ).exclude(status=Appointment.Status.CANCELLED).exists():
            raise serializers.ValidationError("This slot is already booked.")

        # Tele-health validation
        if attrs.get("appointment_type") == Appointment.Type.TELE_HEALTH and not doctor.is_tele_health_enabled:
            raise serializers.ValidationError("This doctor does not offer tele-health consultations.")

        return attrs

    def create(self, validated_data):
        from apps.billing.models import Invoice, InvoiceItem
        from decimal import Decimal

        doctor = validated_data["doctor"]
        currency = validated_data.get("currency", "AED")
        fee_map = {
            "AED": doctor.consultation_fee_aed,
            "SAR": doctor.consultation_fee_sar,
            "EUR": doctor.consultation_fee_eur,
        }
        fee = fee_map.get(currency, doctor.consultation_fee_aed)

        # Apply TeleHealth discount if applicable
        if validated_data.get("appointment_type") == Appointment.Type.TELE_HEALTH:
            discount = Decimal(str(doctor.telehealth_discount_percent)) / Decimal("100")
            fee = (fee * (Decimal("1") - discount)).quantize(Decimal("0.01"))

        validated_data["fee"] = fee
        validated_data["patient"] = self.context["request"].user

        # Generate a unique Jitsi room ID for TeleHealth appointments
        if validated_data.get("appointment_type") == Appointment.Type.TELE_HEALTH:
            import uuid
            validated_data["tele_room_id"] = f"medicore-{uuid.uuid4().hex[:12]}"

        appointment = super().create(validated_data)

        # Auto-create a PENDING invoice for this appointment
        patient = self.context["request"].user
        invoice = Invoice.objects.create(
            patient=patient,
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

        # Store invoice id on appointment notes for reference
        appointment.notes = f"INV:{invoice.invoice_number}"
        appointment.save(update_fields=["notes"])

        return appointment
