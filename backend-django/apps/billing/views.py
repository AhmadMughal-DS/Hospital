from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import Invoice
from .serializers import InvoiceSerializer, InvoiceCreateSerializer
from apps.accounts.models import User


class InvoiceListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return InvoiceCreateSerializer
        return InvoiceSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Invoice.objects.select_related("patient").prefetch_related("items")
        if user.role == User.Role.ADMIN:
            return qs.all()
        return qs.filter(patient=user)

    def create(self, request, *args, **kwargs):
        serializer = InvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


class InvoiceDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Invoice.objects.select_related("patient").prefetch_related("items")
        if user.role == User.Role.ADMIN:
            return qs.all()
        return qs.filter(patient=user)


class MarkInvoicePaidView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.get(pk=pk)
        except Invoice.DoesNotExist:
            return Response({"detail": "Invoice not found."}, status=404)

        if request.user.role not in (User.Role.ADMIN,) and invoice.patient != request.user:
            return Response({"detail": "Not authorized."}, status=403)

        invoice.status = Invoice.Status.PAID
        invoice.amount_paid = invoice.total
        invoice.paid_at = timezone.now()
        invoice.payment_method = request.data.get("payment_method", "CASH")
        invoice.payment_reference = request.data.get("payment_reference", "")
        invoice.save()
        return Response(InvoiceSerializer(invoice).data)


class BillingSummaryView(APIView):
    """Admin billing summary."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMIN:
            return Response({"detail": "Forbidden."}, status=403)
        invoices = Invoice.objects.all()
        total_revenue = sum(i.amount_paid for i in invoices if i.status == Invoice.Status.PAID)
        pending = invoices.filter(status=Invoice.Status.PENDING).count()
        paid = invoices.filter(status=Invoice.Status.PAID).count()
        return Response({
            "total_revenue": float(total_revenue),
            "pending_count": pending,
            "paid_count": paid,
            "total_invoices": invoices.count(),
        })
