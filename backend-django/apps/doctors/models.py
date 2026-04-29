from django.db import models
from apps.accounts.models import User


class Specialty(models.Model):
    name    = models.CharField(max_length=100, unique=True)
    name_ar = models.CharField(max_length=100, blank=True)
    icon    = models.CharField(max_length=50, blank=True, default="🏥")
    description = models.TextField(blank=True)
    is_active   = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "specialties"
        ordering = ["name"]

    def __str__(self):
        return self.name


class DoctorProfile(models.Model):
    class WorkingDay(models.TextChoices):
        MON = "MON", "Monday"
        TUE = "TUE", "Tuesday"
        WED = "WED", "Wednesday"
        THU = "THU", "Thursday"
        FRI = "FRI", "Friday"
        SAT = "SAT", "Saturday"
        SUN = "SUN", "Sunday"

    class Department(models.TextChoices):
        GENERAL   = "GENERAL",   "General Medicine"
        OPD       = "OPD",       "OPD"
        CARDIOLOGY= "CARDIOLOGY","Cardiology"
        ORTHOPEDICS="ORTHOPEDICS","Orthopedics"
        NEUROLOGY = "NEUROLOGY", "Neurology"
        PEDIATRICS= "PEDIATRICS","Pediatrics"
        DERMATOLOGY="DERMATOLOGY","Dermatology"
        RADIOLOGY = "RADIOLOGY", "Radiology"
        EMERGENCY = "EMERGENCY", "Emergency"
        OTHER     = "OTHER",     "Other"

    # ── Identity ───────────────────────────────────────────────────────────────
    user            = models.OneToOneField(User, on_delete=models.CASCADE, related_name="doctor_profile")
    specialty       = models.ForeignKey(Specialty, on_delete=models.SET_NULL, null=True, blank=True, related_name="doctors")
    department      = models.CharField(max_length=20, choices=Department.choices, default=Department.GENERAL)
    license_number  = models.CharField(max_length=50, unique=True)

    # ── Professional ───────────────────────────────────────────────────────────
    bio              = models.TextField(blank=True)
    bio_ar           = models.TextField(blank=True)
    education        = models.TextField(blank=True, help_text="Degrees and institutions")
    experience_years = models.PositiveIntegerField(default=0)
    languages_spoken = models.CharField(max_length=200, blank=True, default="English")

    # ── Consultation Fees (multi-currency) ─────────────────────────────────────
    consultation_fee_aed = models.DecimalField(max_digits=8, decimal_places=2, default=200.00)
    consultation_fee_sar = models.DecimalField(max_digits=8, decimal_places=2, default=200.00)
    consultation_fee_eur = models.DecimalField(max_digits=8, decimal_places=2, default=50.00)

    # ── Schedule ───────────────────────────────────────────────────────────────
    available_from        = models.TimeField(default="08:00")
    available_to          = models.TimeField(default="17:00")
    slot_duration_minutes = models.PositiveIntegerField(default=30)
    # Comma-separated working days: "MON,TUE,WED,THU,FRI"
    working_days          = models.CharField(
        max_length=40,
        default="MON,TUE,WED,THU,FRI",
        help_text="Comma-separated: MON,TUE,WED,THU,FRI,SAT,SUN"
    )

    # ── TeleHealth ─────────────────────────────────────────────────────────────
    is_tele_health_enabled      = models.BooleanField(default=True)
    telehealth_discount_percent = models.PositiveIntegerField(
        default=20,
        help_text="Discount % applied to TeleHealth fee vs in-person fee"
    )

    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_active"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"Dr. {self.user.get_full_name()} — {self.specialty}"

    @property
    def working_days_list(self):
        return [d.strip() for d in self.working_days.split(",") if d.strip()]
