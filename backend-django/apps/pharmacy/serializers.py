from rest_framework import serializers
from .models import Drug, StockMovement


class DrugSerializer(serializers.ModelSerializer):
    is_low_stock  = serializers.BooleanField(read_only=True)
    is_expired    = serializers.BooleanField(read_only=True)
    needs_reorder = serializers.BooleanField(read_only=True)
    margin_percent = serializers.FloatField(read_only=True)

    class Meta:
        model = Drug
        fields = [
            "id", "name", "name_ar", "generic_name", "brand_name", "sku",
            "category", "unit", "strength", "dosage_form",
            "is_controlled", "requires_prescription",
            "manufacturer", "supplier_name", "batch_number",
            "storage_conditions",
            "unit_price_aed", "unit_cost_aed",
            "stock_quantity", "low_stock_threshold", "reorder_level", "reorder_quantity",
            "expiry_date", "is_active",
            "is_low_stock", "is_expired", "needs_reorder", "margin_percent",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StockMovementSerializer(serializers.ModelSerializer):
    drug_name       = serializers.CharField(source="drug.name", read_only=True)
    performed_by_name = serializers.CharField(source="performed_by.get_full_name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id", "drug", "drug_name", "movement_type", "quantity",
            "stock_before", "stock_after", "unit_cost",
            "reference", "notes", "performed_by", "performed_by_name", "created_at",
        ]
        read_only_fields = ["id", "stock_before", "stock_after", "created_at"]

    def create(self, validated_data):
        # Set performed_by from request user
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data.setdefault("performed_by", request.user)

        drug = validated_data["drug"]
        validated_data["stock_before"] = drug.stock_quantity

        movement = super().create(validated_data)

        # Update stock
        if movement.movement_type == StockMovement.MovementType.IN:
            drug.stock_quantity += movement.quantity
        elif movement.movement_type in (
            StockMovement.MovementType.OUT,
            StockMovement.MovementType.EXPIRED,
            StockMovement.MovementType.RETURN,
        ):
            drug.stock_quantity = max(0, drug.stock_quantity - movement.quantity)
        elif movement.movement_type == StockMovement.MovementType.ADJUSTMENT:
            drug.stock_quantity = max(0, movement.quantity)

        drug.save(update_fields=["stock_quantity"])

        # Record stock_after
        movement.stock_after = drug.stock_quantity
        movement.save(update_fields=["stock_after"])

        return movement
