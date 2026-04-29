import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN       = "ADMIN",       "Admin"
        DOCTOR      = "DOCTOR",      "Doctor"
        PHARMACIST  = "PHARMACIST",  "Pharmacist"
        PATIENT     = "PATIENT",     "Patient"

    email               = models.EmailField(unique=True)
    role                = models.CharField(max_length=16, choices=Role.choices, default=Role.PATIENT)
    language_preference = models.CharField(max_length=5, default="en")
    timezone            = models.CharField(max_length=64, default="Asia/Dubai")
    phone_number        = models.CharField(max_length=25, blank=True)
    is_email_verified   = models.BooleanField(default=False)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return f"{self.email} ({self.role})"


class PatientProfile(models.Model):
    class BloodGroup(models.TextChoices):
        A_POS  = "A+",  "A+"
        A_NEG  = "A-",  "A-"
        B_POS  = "B+",  "B+"
        B_NEG  = "B-",  "B-"
        AB_POS = "AB+", "AB+"
        AB_NEG = "AB-", "AB-"
        O_POS  = "O+",  "O+"
        O_NEG  = "O-",  "O-"
        UNKNOWN = "UNKNOWN", "Unknown"

    class Gender(models.TextChoices):
        MALE    = "MALE",   "Male"
        FEMALE  = "FEMALE", "Female"
        OTHER   = "OTHER",  "Other"

    # ── Identity ───────────────────────────────────────────────────────────────
    user              = models.OneToOneField(User, on_delete=models.CASCADE, related_name="patient_profile")
    patient_id        = models.CharField(max_length=20, unique=True, db_index=True, editable=False)

    # ── Demographics ───────────────────────────────────────────────────────────
    date_of_birth     = models.DateField(null=True, blank=True)
    gender            = models.CharField(max_length=8, choices=Gender.choices, blank=True)
    nationality       = models.CharField(max_length=60, blank=True)
    national_id       = models.CharField(max_length=30, blank=True, verbose_name="National ID / Passport")
    address           = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=100, blank=True)
    emergency_phone   = models.CharField(max_length=25, blank=True)

    # ── Clinical ───────────────────────────────────────────────────────────────
    blood_group         = models.CharField(max_length=8, choices=BloodGroup.choices, default=BloodGroup.UNKNOWN)
    allergies           = models.TextField(blank=True, help_text="Comma-separated list of known allergies")
    chronic_conditions  = models.TextField(blank=True, help_text="e.g. Diabetes, Hypertension")
    current_medications = models.TextField(blank=True)

    # ── Insurance ──────────────────────────────────────────────────────────────
    insurance_provider = models.CharField(max_length=100, blank=True)
    insurance_number   = models.CharField(max_length=50, blank=True)
    insurance_expiry   = models.DateField(null=True, blank=True)

    # ── Consent ────────────────────────────────────────────────────────────────
    consent_version  = models.CharField(max_length=20, default="v1")
    consent_given_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.patient_id:
            self.patient_id = f"PT-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        indexes = [
            models.Index(fields=["patient_id"]),
            models.Index(fields=["blood_group"]),
        ]

    def __str__(self):
        return f"{self.patient_id} — {self.user.get_full_name()}"
