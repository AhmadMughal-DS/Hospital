from django.contrib import admin
from .models import Drug, StockMovement


@admin.register(Drug)
class DrugAdmin(admin.ModelAdmin):
    list_display = ["name", "sku", "stock_quantity", "low_stock_threshold", "expiry_date", "is_active"]
    list_filter = ["is_active", "is_controlled", "category"]
    search_fields = ["name", "sku", "generic_name"]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ["drug", "movement_type", "quantity", "reference", "created_at"]
    list_filter = ["movement_type"]
