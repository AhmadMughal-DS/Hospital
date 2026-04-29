import uuid
from django.db import models
from apps.accounts.models import User
from apps.doctors.models import DoctorProfile


class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED   = "SCHEDULED",   "Scheduled"
        CONFIRMED   = "CONFIRMED",   "Confirmed"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED   = "COMPLETED",   "Completed"
        CANCELLED   = "CANCELLED",   "Cancelled"
        NO_SHOW     = "NO_SHOW",     "No Show"

    class Type(models.TextChoices):
        IN_PERSON  = "IN_PERSON",  "In Person"
        TELE_HEALTH = "TELE_HEALTH", "Tele Health"

    class Currency(models.TextChoices):
        AED = "AED", "UAE Dirham"
        SAR = "SAR", "Saudi Riyal"
        EUR = "EUR", "Euro"

    # ── Reference ──────────────────────────────────────────────────────────────
    appointment_ref = models.CharField(max_length=20, unique=True, db_index=True, editable=False)

    # ── Parties ────────────────────────────────────────────────────────────────
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="appointments")
    doctor  = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name="appointments")

    # ── Schedule ───────────────────────────────────────────────────────────────
    appointment_date  = models.DateField(db_index=True)
    appointment_time  = models.TimeField()
    duration_minutes  = models.PositiveIntegerField(default=30)
    appointment_type  = models.CharField(max_length=16, choices=Type.choices, default=Type.IN_PERSON)

    # ── Status ─────────────────────────────────────────────────────────────────
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SCHEDULED, db_index=True)

    # ── Financial ──────────────────────────────────────────────────────────────
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.AED)
    fee      = models.DecimalField(max_digits=8, decimal_places=2)

    # ── Clinical ───────────────────────────────────────────────────────────────
    chief_complaint    = models.TextField(blank=True)
    notes              = models.TextField(blank=True)
    diagnosis          = models.TextField(blank=True)
    follow_up_date     = models.DateField(null=True, blank=True)
    follow_up_required = models.BooleanField(default=False)

    # ── TeleHealth ─────────────────────────────────────────────────────────────
    tele_room_id = models.CharField(max_length=100, blank=True, db_index=True)

    # ── Audit ──────────────────────────────────────────────────────────────────
    booked_by  = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="booked_appointments",
        help_text="If different from patient (e.g., admin/receptionist)"
    )
    cancelled_at     = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.appointment_ref:
            self.appointment_ref = f"APT-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-appointment_date", "-appointment_time"]
        unique_together = [["doctor", "appointment_date", "appointment_time"]]
        indexes = [
            models.Index(fields=["appointment_date", "status"]),
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["doctor", "appointment_date"]),
        ]

    def __str__(self):
        return f"{self.appointment_ref} — {self.patient.email} with Dr. {self.doctor.user.get_full_name()}"


# ── Prescription ───────────────────────────────────────────────────────────────

class Prescription(models.Model):
    appointment   = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="prescription")
    notes         = models.TextField(blank=True)
    diagnosis     = models.TextField(blank=True)
    issued_at     = models.DateTimeField(auto_now_add=True)
    is_dispensed  = models.BooleanField(default=False)
    dispensed_at  = models.DateTimeField(null=True, blank=True)
    dispensed_by  = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="dispensed_prescriptions"
    )

    class Meta:
        ordering = ["-issued_at"]

    def __str__(self):
        return f"Rx for {self.appointment.appointment_ref}"


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name="items")

    # Soft reference (name as written by doctor)
    drug_name    = models.CharField(max_length=200)

    # Hard FK to inventory (set when pharmacist dispenses)
    drug = models.ForeignKey(
        "pharmacy.Drug", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="prescription_items",
        help_text="Linked inventory drug (set on dispensing)"
    )

    dosage           = models.CharField(max_length=100)
    frequency        = models.CharField(max_length=100, help_text="e.g. Twice daily, Every 8 hours")
    duration_days    = models.PositiveIntegerField(default=7)
    instructions     = models.TextField(blank=True)
    quantity         = models.PositiveIntegerField(default=1)
    is_dispensed     = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.drug_name} — {self.dosage}"


# ── OPD (Outpatient Department) ────────────────────────────────────────────────

class OPDVisit(models.Model):
    class Status(models.TextChoices):
        WAITING     = "WAITING",     "Waiting"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        SEEN        = "SEEN",        "Seen"
        REFERRED    = "REFERRED",    "Referred"
        DISCHARGED  = "DISCHARGED",  "Discharged"

    # ── Reference ──────────────────────────────────────────────────────────────
    opd_ref = models.CharField(max_length=20, unique=True, db_index=True, editable=False)

    # ── Patient Info ───────────────────────────────────────────────────────────
    patient_name  = models.CharField(max_length=200)
    patient_phone = models.CharField(max_length=30, blank=True)
    age           = models.PositiveIntegerField(null=True, blank=True)
    gender        = models.CharField(max_length=10, blank=True)

    # ── Clinical ───────────────────────────────────────────────────────────────
    reason        = models.TextField(blank=True)
    bp            = models.CharField(max_length=20, blank=True, verbose_name="Blood Pressure (mmHg)")
    temperature   = models.CharField(max_length=10, blank=True, verbose_name="Temperature (°C)")
    weight_kg     = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    pulse_rate    = models.CharField(max_length=10, blank=True, verbose_name="Pulse (bpm)")
    oxygen_saturation = models.CharField(max_length=10, blank=True, verbose_name="SpO₂ (%)")
    notes         = models.TextField(blank=True)
    diagnosis     = models.TextField(blank=True)

    # ── Assignment ─────────────────────────────────────────────────────────────
    referring_doctor = models.ForeignKey(
        DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="opd_referrals"
    )
    linked_appointment = models.ForeignKey(
        Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name="opd_visits"
    )

    status     = models.CharField(max_length=16, choices=Status.choices, default=Status.WAITING, db_index=True)
    visit_date = models.DateField(auto_now_add=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.opd_ref:
            self.opd_ref = f"OPD-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["visit_date", "status"]),
        ]

    def __str__(self):
        return f"{self.opd_ref} — {self.patient_name} ({self.visit_date})"


# ── Radiology / X-Ray ──────────────────────────────────────────────────────────

class XRayRequest(models.Model):
    class Status(models.TextChoices):
        PENDING     = "PENDING",     "Pending"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        DONE        = "DONE",        "Done"
        REPORTED    = "REPORTED",    "Reported"
        CANCELLED   = "CANCELLED",   "Cancelled"

    XRAY_TYPES = [
        ("CHEST",   "Chest X-Ray"),
        ("KNEE",    "Knee"),
        ("SPINE",   "Spine"),
        ("PELVIS",  "Pelvis"),
        ("HAND",    "Hand / Wrist"),
        ("FOOT",    "Foot / Ankle"),
        ("SKULL",   "Skull"),
        ("ABDOMEN", "Abdomen"),
        ("OTHER",   "Other"),
    ]

    # ── Reference ──────────────────────────────────────────────────────────────
    xray_ref = models.CharField(max_length=20, unique=True, db_index=True, editable=False)

    # ── Patient Info ───────────────────────────────────────────────────────────
    patient_name  = models.CharField(max_length=200)
    patient_phone = models.CharField(max_length=30, blank=True)
    age           = models.PositiveIntegerField(null=True, blank=True)
    gender        = models.CharField(max_length=10, blank=True)

    # ── Request ────────────────────────────────────────────────────────────────
    xray_type        = models.CharField(max_length=20, choices=XRAY_TYPES, default="CHEST")
    clinical_history = models.TextField(blank=True)
    referring_doctor = models.ForeignKey(
        DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="xray_requests"
    )
    linked_appointment = models.ForeignKey(
        Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name="xray_requests"
    )
    urgency = models.CharField(
        max_length=10,
        choices=[("ROUTINE", "Routine"), ("URGENT", "Urgent"), ("STAT", "STAT/Emergency")],
        default="ROUTINE"
    )

    # ── Result ─────────────────────────────────────────────────────────────────
    status       = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    notes        = models.TextField(blank=True)
    report       = models.TextField(blank=True, verbose_name="Radiologist Report")
    reported_by  = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="xray_reports"
    )
    reported_at  = models.DateTimeField(null=True, blank=True)

    requested_at = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.xray_ref:
            self.xray_ref = f"XRY-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["urgency", "status"]),
        ]

    def __str__(self):
        return f"{self.xray_ref} — {self.xray_type} for {self.patient_name}"
