from rest_framework import serializers
from .models import Invoice, InvoiceItem


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ["id", "item_type", "description", "quantity", "unit_price", "total_price"]
        read_only_fields = ["id", "total_price"]


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    patient_name = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "patient", "patient_name",
            "status", "currency",
            "subtotal", "tax_rate", "tax_amount", "discount_amount", "total",
            "amount_paid", "balance_due",
            "payment_method", "payment_reference",
            "notes", "due_date", "paid_at",
            "items", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "invoice_number", "tax_amount", "total", "created_at", "updated_at"]

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() or obj.patient.email

    def get_balance_due(self, obj):
        return float(obj.total - obj.amount_paid)


class InvoiceCreateSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)

    class Meta:
        model = Invoice
        fields = [
            "patient", "currency", "tax_rate", "discount_amount",
            "payment_method", "notes", "due_date", "items",
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        subtotal = sum(item["unit_price"] * item["quantity"] for item in items_data)
        validated_data["subtotal"] = subtotal
        invoice = Invoice.objects.create(**validated_data)
        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        invoice.save()  # recalculate totals
        return invoice
