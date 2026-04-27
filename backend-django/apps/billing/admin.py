from django.contrib import admin
from .models import Invoice, InvoiceItem


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1
    readonly_fields = ["total_price"]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ["invoice_number", "patient", "status", "currency", "total", "amount_paid", "created_at"]
    list_filter = ["status", "currency", "payment_method"]
    search_fields = ["invoice_number", "patient__email"]
    readonly_fields = ["invoice_number", "tax_amount", "total"]
    inlines = [InvoiceItemInline]
