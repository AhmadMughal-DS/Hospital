import uuid
from django.utils import timezone
from django.db import models


class Drug(models.Model):
    class Category(models.TextChoices):
        ANTIBIOTIC    = "ANTIBIOTIC",    "Antibiotic"
        ANALGESIC     = "ANALGESIC",     "Analgesic / Pain Relief"
        ANTIDIABETIC  = "ANTIDIABETIC",  "Antidiabetic"
        ANTIHYPERTENSIVE = "ANTIHYPERTENSIVE", "Antihypertensive"
        ANTIHISTAMINE = "ANTIHISTAMINE", "Antihistamine"
        ANTIVIRAL     = "ANTIVIRAL",     "Antiviral"
        VITAMIN       = "VITAMIN",       "Vitamin / Supplement"
        CARDIOVASCULAR= "CARDIOVASCULAR","Cardiovascular"
        GASTROINTESTINAL = "GASTROINTESTINAL", "Gastrointestinal"
        RESPIRATORY   = "RESPIRATORY",   "Respiratory"
        DERMATOLOGICAL= "DERMATOLOGICAL","Dermatological"
        OPHTHALMIC    = "OPHTHALMIC",    "Ophthalmic"
        OTHER         = "OTHER",         "Other"

    # ── Identity ───────────────────────────────────────────────────────────────
    name         = models.CharField(max_length=200, db_index=True)
    name_ar      = models.CharField(max_length=200, blank=True)
    generic_name = models.CharField(max_length=200, blank=True)
    brand_name   = models.CharField(max_length=200, blank=True)
    sku          = models.CharField(max_length=50, unique=True, db_index=True)

    # ── Classification ─────────────────────────────────────────────────────────
    category      = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    unit          = models.CharField(max_length=50, default="tablet")
    strength      = models.CharField(max_length=50, blank=True, help_text="e.g. 500mg, 10ml")
    dosage_form   = models.CharField(
        max_length=20,
        choices=[
            ("TABLET","Tablet"), ("CAPSULE","Capsule"), ("SYRUP","Syrup"),
            ("INJECTION","Injection"), ("CREAM","Cream"), ("DROPS","Drops"),
            ("INHALER","Inhaler"), ("PATCH","Patch"), ("SACHET","Sachet"), ("OTHER","Other"),
        ],
        default="TABLET"
    )
    is_controlled = models.BooleanField(default=False, help_text="Controlled/narcotic substance")
    requires_prescription = models.BooleanField(default=True)

    # ── Supply Chain ───────────────────────────────────────────────────────────
    manufacturer  = models.CharField(max_length=200, blank=True)
    supplier_name = models.CharField(max_length=200, blank=True)
    batch_number  = models.CharField(max_length=50, blank=True)
    storage_conditions = models.CharField(
        max_length=20,
        choices=[
            ("ROOM_TEMP","Room Temperature"),("REFRIGERATED","Refrigerated"),
            ("FROZEN","Frozen"),("COOL_DRY","Cool & Dry"),
        ],
        default="ROOM_TEMP"
    )

    # ── Pricing ────────────────────────────────────────────────────────────────
    unit_price_aed = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    unit_cost_aed  = models.DecimalField(max_digits=8, decimal_places=2, default=0, help_text="Purchase cost (for margin calculation)")

    # ── Inventory ──────────────────────────────────────────────────────────────
    stock_quantity      = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=10)
    reorder_level       = models.PositiveIntegerField(default=20, help_text="Trigger reorder when stock hits this level")
    reorder_quantity    = models.PositiveIntegerField(default=100, help_text="Standard reorder quantity")
    expiry_date         = models.DateField(null=True, blank=True)

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_low_stock(self):
        return self.stock_quantity <= self.low_stock_threshold

    @property
    def needs_reorder(self):
        return self.stock_quantity <= self.reorder_level

    @property
    def is_expired(self):
        if self.expiry_date:
            return self.expiry_date < timezone.now().date()
        return False

    @property
    def margin_percent(self):
        if self.unit_cost_aed and self.unit_price_aed:
            return round((float(self.unit_price_aed) - float(self.unit_cost_aed)) / float(self.unit_price_aed) * 100, 1)
        return None

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["category"]),
            models.Index(fields=["is_active", "stock_quantity"]),
            models.Index(fields=["expiry_date"]),
        ]

    def __str__(self):
        return f"{self.name} {self.strength} ({self.sku})"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        IN          = "IN",         "Stock In (Purchase)"
        OUT         = "OUT",        "Stock Out (Dispensed)"
        ADJUSTMENT  = "ADJUSTMENT", "Manual Adjustment"
        EXPIRED     = "EXPIRED",    "Removed — Expired"
        RETURN      = "RETURN",     "Patient Return"
        TRANSFER    = "TRANSFER",   "Inter-dept Transfer"

    drug          = models.ForeignKey(Drug, on_delete=models.CASCADE, related_name="movements")
    movement_type = models.CharField(max_length=16, choices=MovementType.choices)
    quantity      = models.IntegerField(help_text="Positive = added, Negative not used (use movement_type)")
    stock_before  = models.PositiveIntegerField(default=0, help_text="Stock level before this movement")
    stock_after   = models.PositiveIntegerField(default=0, help_text="Stock level after this movement")
    unit_cost     = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    reference     = models.CharField(max_length=100, blank=True, help_text="Invoice/PO/Prescription ref")
    notes         = models.TextField(blank=True)
    performed_by  = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="stock_movements",
        help_text="Staff member who recorded this movement"
    )
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["drug", "created_at"]),
            models.Index(fields=["movement_type"]),
        ]

    def __str__(self):
        return f"{self.movement_type} {self.quantity}× {self.drug.name} ({self.created_at.date()})"
