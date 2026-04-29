import uuid
from django.db import models
from apps.accounts.models import User
from apps.doctors.models import DoctorProfile


class QueueToken(models.Model):
    class Status(models.TextChoices):
        WAITING     = "WAITING",     "Waiting"
        CALLED      = "CALLED",      "Called"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED   = "COMPLETED",   "Completed"
        SKIPPED     = "SKIPPED",     "Skipped"
        CANCELLED   = "CANCELLED",   "Cancelled"

    class Department(models.TextChoices):
        GENERAL    = "GENERAL",    "General / Reception"
        OPD        = "OPD",        "OPD"
        PHARMACY   = "PHARMACY",   "Pharmacy"
        XRAY       = "XRAY",       "X-Ray / Radiology"
        LAB        = "LAB",        "Laboratory"
        BILLING    = "BILLING",    "Billing / Cashier"
        EMERGENCY  = "EMERGENCY",  "Emergency"

    # ── Reference ──────────────────────────────────────────────────────────────
    token_number = models.PositiveIntegerField()
    token_ref    = models.CharField(max_length=20, unique=True, editable=False)

    # ── Patient ────────────────────────────────────────────────────────────────
    patient      = models.ForeignKey(User, on_delete=models.CASCADE, related_name="queue_tokens", null=True, blank=True)
    patient_name = models.CharField(max_length=150, blank=True, help_text="For walk-in patients without account")

    # ── Routing ────────────────────────────────────────────────────────────────
    doctor     = models.ForeignKey(DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="queue_tokens")
    department = models.CharField(max_length=16, choices=Department.choices, default=Department.GENERAL, db_index=True)

    # ── Queue State ────────────────────────────────────────────────────────────
    queue_date              = models.DateField(db_index=True)
    status                  = models.CharField(max_length=16, choices=Status.choices, default=Status.WAITING, db_index=True)
    is_priority             = models.BooleanField(default=False)
    estimated_wait_minutes  = models.PositiveIntegerField(default=0)

    # ── Timestamps ─────────────────────────────────────────────────────────────
    called_at     = models.DateTimeField(null=True, blank=True)
    completed_at  = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    # ── Notes ──────────────────────────────────────────────────────────────────
    notes = models.CharField(max_length=200, blank=True)

    def save(self, *args, **kwargs):
        if not self.token_ref:
            self.token_ref = f"TKN-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["queue_date", "is_priority", "token_number"]
        unique_together = [["queue_date", "token_number", "department"]]
        indexes = [
            models.Index(fields=["queue_date", "department", "status"]),
        ]

    def __str__(self):
        return f"Token #{self.token_number} [{self.department}] — {self.status} ({self.queue_date})"

    @property
    def patient_display(self):
        if self.patient:
            return self.patient.get_full_name() or self.patient.email
        return self.patient_name or "Walk-in"
