from rest_framework import serializers
from .models import Drug, StockMovement


class DrugSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Drug
        fields = [
            "id", "name", "name_ar", "generic_name", "sku", "category",
            "unit", "unit_price_aed", "stock_quantity",
            "low_stock_threshold", "expiry_date",
            "is_controlled", "is_active",
            "is_low_stock", "is_expired",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StockMovementSerializer(serializers.ModelSerializer):
    drug_name = serializers.CharField(source="drug.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = ["id", "drug", "drug_name", "movement_type", "quantity", "reference", "notes", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        movement = super().create(validated_data)
        drug = movement.drug
        if movement.movement_type == StockMovement.MovementType.IN:
            drug.stock_quantity += movement.quantity
        elif movement.movement_type in (
            StockMovement.MovementType.OUT,
            StockMovement.MovementType.EXPIRED,
        ):
            drug.stock_quantity = max(0, drug.stock_quantity - movement.quantity)
        elif movement.movement_type == StockMovement.MovementType.ADJUSTMENT:
            drug.stock_quantity = max(0, movement.quantity)
        drug.save(update_fields=["stock_quantity"])
        return movement
