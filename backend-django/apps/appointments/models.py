import uuid
from django.db import models
from apps.accounts.models import User
from apps.doctors.models import DoctorProfile


class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        CONFIRMED = "CONFIRMED", "Confirmed"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        NO_SHOW = "NO_SHOW", "No Show"

    class Type(models.TextChoices):
        IN_PERSON = "IN_PERSON", "In Person"
        TELE_HEALTH = "TELE_HEALTH", "Tele Health"

    class Currency(models.TextChoices):
        AED = "AED", "UAE Dirham"
        SAR = "SAR", "Saudi Riyal"
        EUR = "EUR", "Euro"

    appointment_ref = models.CharField(max_length=20, unique=True, db_index=True, editable=False)
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="appointments")
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name="appointments")
    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(default=30)
    appointment_type = models.CharField(max_length=16, choices=Type.choices, default=Type.IN_PERSON)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SCHEDULED)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.AED)
    fee = models.DecimalField(max_digits=8, decimal_places=2)
    chief_complaint = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    tele_room_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.appointment_ref:
            self.appointment_ref = f"APT-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-appointment_date", "-appointment_time"]
        unique_together = [["doctor", "appointment_date", "appointment_time"]]

    def __str__(self):
        return f"{self.appointment_ref} — {self.patient.email} with Dr. {self.doctor.user.get_full_name()}"


class Prescription(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="prescription")
    notes = models.TextField(blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    is_dispensed = models.BooleanField(default=False)

    def __str__(self):
        return f"Rx for {self.appointment.appointment_ref}"


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name="items")
    drug_name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100)
    frequency = models.CharField(max_length=100)
    duration_days = models.PositiveIntegerField(default=7)
    instructions = models.TextField(blank=True)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.drug_name} — {self.dosage}"
