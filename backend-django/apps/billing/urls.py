from django.urls import path
from .views import (
    InvoiceListCreateView, InvoiceDetailView,
    MarkInvoicePaidView, BillingSummaryView,
    StripeCreateIntentView,
)

urlpatterns = [
    path("invoices/", InvoiceListCreateView.as_view(), name="invoice-list"),
    path("invoices/<int:pk>/", InvoiceDetailView.as_view(), name="invoice-detail"),
    path("invoices/<int:pk>/pay/", MarkInvoicePaidView.as_view(), name="invoice-pay"),
    path("summary/", BillingSummaryView.as_view(), name="billing-summary"),
    path("stripe/create-intent/", StripeCreateIntentView.as_view(), name="stripe-intent"),
]
