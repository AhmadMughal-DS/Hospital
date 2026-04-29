import uuid
from decimal import Decimal
from django.db import models
from apps.accounts.models import User


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT          = "DRAFT",          "Draft"
        PENDING        = "PENDING",        "Pending"
        PAID           = "PAID",           "Paid"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially Paid"
        REFUNDED       = "REFUNDED",       "Refunded"
        CANCELLED      = "CANCELLED",      "Cancelled"
        OVERDUE        = "OVERDUE",        "Overdue"

    class Currency(models.TextChoices):
        AED = "AED", "UAE Dirham"
        SAR = "SAR", "Saudi Riyal"
        EUR = "EUR", "Euro"
        USD = "USD", "US Dollar"

    class PaymentMethod(models.TextChoices):
        CASH      = "CASH",      "Cash"
        CARD      = "CARD",      "Card / POS"
        STRIPE    = "STRIPE",    "Stripe Online"
        PAYPAL    = "PAYPAL",    "PayPal"
        INSURANCE = "INSURANCE", "Insurance"
        BANK      = "BANK",      "Bank Transfer"
        WAIVED    = "WAIVED",    "Waived"

    # ── Reference ──────────────────────────────────────────────────────────────
    invoice_number = models.CharField(max_length=20, unique=True, db_index=True, editable=False)

    # ── Parties ────────────────────────────────────────────────────────────────
    patient     = models.ForeignKey(User, on_delete=models.CASCADE, related_name="invoices")
    appointment = models.OneToOneField(
        "appointments.Appointment", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="invoice",
        help_text="Linked appointment (if applicable)"
    )

    # ── Financial ──────────────────────────────────────────────────────────────
    status          = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    currency        = models.CharField(max_length=3, choices=Currency.choices, default=Currency.AED)
    subtotal        = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    tax_rate        = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("5.00"), help_text="VAT %")
    tax_amount      = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total           = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    amount_paid     = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    # ── Payment ────────────────────────────────────────────────────────────────
    payment_method    = models.CharField(max_length=16, choices=PaymentMethod.choices, blank=True)
    payment_reference = models.CharField(max_length=200, blank=True, help_text="Stripe PI, bank ref, etc.")
    stripe_payment_intent_id = models.CharField(max_length=100, blank=True, db_index=True)

    # ── Dates ──────────────────────────────────────────────────────────────────
    due_date   = models.DateField(null=True, blank=True)
    paid_at    = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ── Notes ──────────────────────────────────────────────────────────────────
    notes           = models.TextField(blank=True)
    internal_notes  = models.TextField(blank=True, help_text="Staff-only notes (not shown to patient)")

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
        self.tax_amount = (self.subtotal * self.tax_rate / 100).quantize(Decimal("0.01"))
        self.total = (self.subtotal + self.tax_amount - self.discount_amount).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)

    @property
    def balance_due(self):
        return self.total - self.amount_paid

    @property
    def is_overdue(self):
        from django.utils import timezone
        return self.due_date and self.due_date < timezone.now().date() and self.status == "PENDING"

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["stripe_payment_intent_id"]),
        ]

    def __str__(self):
        return f"{self.invoice_number} — {self.patient.email} ({self.status})"


class InvoiceItem(models.Model):
    class ItemType(models.TextChoices):
        CONSULTATION = "CONSULTATION", "Consultation"
        MEDICINE     = "MEDICINE",     "Medicine"
        LAB_TEST     = "LAB_TEST",     "Lab Test"
        XRAY         = "XRAY",         "X-Ray / Radiology"
        PROCEDURE    = "PROCEDURE",    "Procedure"
        ROOM_CHARGE  = "ROOM_CHARGE",  "Room Charge"
        OTHER        = "OTHER",        "Other"

    invoice     = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    item_type   = models.CharField(max_length=20, choices=ItemType.choices, default=ItemType.CONSULTATION)
    description = models.CharField(max_length=300)
    quantity    = models.PositiveIntegerField(default=1)
    unit_price  = models.DecimalField(max_digits=8, decimal_places=2)
    discount    = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    # Optional FK to drug (for medicine items)
    drug = models.ForeignKey(
        "pharmacy.Drug", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="invoice_items"
    )

    def save(self, *args, **kwargs):
        self.total_price = (self.unit_price * self.quantity) - self.discount
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} × {self.quantity} @ {self.unit_price}"
