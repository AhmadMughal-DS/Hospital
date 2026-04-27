import uuid
from django.db import models
from apps.accounts.models import User
from apps.doctors.models import DoctorProfile


class QueueToken(models.Model):
    class Status(models.TextChoices):
        WAITING = "WAITING", "Waiting"
        CALLED = "CALLED", "Called"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        SKIPPED = "SKIPPED", "Skipped"
        CANCELLED = "CANCELLED", "Cancelled"

    token_number = models.PositiveIntegerField()
    token_ref = models.CharField(max_length=20, unique=True, editable=False)
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="queue_tokens", null=True, blank=True)
    patient_name = models.CharField(max_length=150, blank=True)  # for walk-ins
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="queue_tokens")
    queue_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.WAITING)
    is_priority = models.BooleanField(default=False)
    called_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    estimated_wait_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.token_ref:
            self.token_ref = f"TKN-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["queue_date", "token_number"]
        unique_together = [["queue_date", "token_number"]]

    def __str__(self):
        return f"Token #{self.token_number} — {self.status} ({self.queue_date})"
