from django.db import models
from apps.accounts.models import User


class Specialty(models.Model):
    name = models.CharField(max_length=100, unique=True)
    name_ar = models.CharField(max_length=100, blank=True)
    icon = models.CharField(max_length=50, blank=True, default="🏥")

    class Meta:
        verbose_name_plural = "specialties"

    def __str__(self):
        return self.name


class DoctorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="doctor_profile")
    specialty = models.ForeignKey(Specialty, on_delete=models.SET_NULL, null=True, related_name="doctors")
    license_number = models.CharField(max_length=50, unique=True)
    bio = models.TextField(blank=True)
    bio_ar = models.TextField(blank=True)
    consultation_fee_aed = models.DecimalField(max_digits=8, decimal_places=2, default=200.00)
    consultation_fee_sar = models.DecimalField(max_digits=8, decimal_places=2, default=200.00)
    consultation_fee_eur = models.DecimalField(max_digits=8, decimal_places=2, default=50.00)
    available_from = models.TimeField(default="08:00")
    available_to = models.TimeField(default="17:00")
    slot_duration_minutes = models.PositiveIntegerField(default=30)
    is_tele_health_enabled = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dr. {self.user.get_full_name()} — {self.specialty}"
