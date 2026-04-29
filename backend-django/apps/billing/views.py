import os
from decimal import Decimal

from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .models import Invoice
from .serializers import InvoiceCreateSerializer, InvoiceSerializer


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

        # Admin can pay any, patient can only pay their own
        if request.user.role not in (User.Role.ADMIN,) and invoice.patient != request.user:
            return Response({"detail": "Not authorized."}, status=403)

        if invoice.status == Invoice.Status.PAID:
            return Response({"detail": "Invoice is already paid."}, status=400)

        invoice.status = Invoice.Status.PAID
        invoice.amount_paid = invoice.total
        invoice.paid_at = timezone.now()
        invoice.payment_method = request.data.get("payment_method", "CARD")
        invoice.payment_reference = request.data.get("payment_reference", "")
        invoice.save()

        # If invoice has an associated appointment, confirm it
        from apps.appointments.models import Appointment
        appointment = None
        try:
            appointment = Appointment.objects.select_related(
                "doctor__user", "doctor__specialty", "patient"
            ).filter(notes__contains=invoice.invoice_number).first()
            if appointment and appointment.status == Appointment.Status.SCHEDULED:
                appointment.status = Appointment.Status.CONFIRMED
                appointment.save(update_fields=["status"])
        except Exception:
            pass

        # Send email confirmation ticket to patient
        self._send_ticket_email(invoice, appointment)

        return Response(InvoiceSerializer(invoice).data)

    def _send_ticket_email(self, invoice, appointment):
        """Send an appointment confirmation ticket to the patient's email."""
        patient = invoice.patient
        patient_email = patient.email
        patient_name = patient.get_full_name() or patient.email

        if appointment:
            doctor_name = f"Dr. {appointment.doctor.user.get_full_name()}"
            apt_date = appointment.appointment_date.strftime("%d %B %Y")
            apt_time = appointment.appointment_time.strftime("%I:%M %p")
            apt_type = "TeleHealth (Online)" if appointment.appointment_type == "TELE_HEALTH" else "In-Person Visit"
            apt_ref = appointment.appointment_ref
            specialty = appointment.doctor.specialty.name if appointment.doctor.specialty else ""
        else:
            doctor_name = "N/A"
            apt_date = "N/A"
            apt_time = "N/A"
            apt_type = "N/A"
            apt_ref = "N/A"
            specialty = ""

        subject = f"✅ Appointment Confirmed — {apt_ref} | MediCore HMS"

        message = f"""
Dear {patient_name},

Your appointment has been confirmed and payment received. Here are your booking details:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥  APPOINTMENT TICKET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Reference:   {apt_ref}
  Doctor:      {doctor_name}
  Specialty:   {specialty}
  Date:        {apt_date}
  Time:        {apt_time}
  Type:        {apt_type}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Invoice:     {invoice.invoice_number}
  Amount Paid: {invoice.total} {invoice.currency}
  Payment:     {invoice.payment_method}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please arrive 10 minutes early for in-person visits.
For TeleHealth, you will receive a video link before your appointment.

Thank you for choosing MediCore HMS.

— MediCore Healthcare Team
""".strip()

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=os.environ.get("EMAIL_HOST_USER", "noreply@medicore.ae"),
                recipient_list=[patient_email],
                fail_silently=True,
            )
        except Exception:
            pass  # Never block the payment response due to email failure


class StripeCreateIntentView(APIView):
    """
    POST /api/v1/billing/stripe/create-intent/
    Body: { "invoice_id": <int> }
    Returns: { "client_secret": "pi_xxx_secret_yyy", "publishable_key": "pk_test_..." }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import stripe
        from pathlib import Path
        from dotenv import dotenv_values

        # Always read directly from .env file so no server restart is needed
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        env_vars = dotenv_values(env_path)

        secret_key = env_vars.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_SECRET_KEY", "")
        pub_key = env_vars.get("STRIPE_PUBLISHABLE_KEY") or os.environ.get("STRIPE_PUBLISHABLE_KEY", "")

        stripe.api_key = secret_key
        if not stripe.api_key or "placeholder" in stripe.api_key:
            return Response({"detail": "Stripe is not configured."}, status=503)

        invoice_id = request.data.get("invoice_id")
        if not invoice_id:
            return Response({"detail": "invoice_id is required."}, status=400)

        try:
            invoice = Invoice.objects.get(pk=invoice_id, patient=request.user)
        except Invoice.DoesNotExist:
            return Response({"detail": "Invoice not found."}, status=404)

        if invoice.status == Invoice.Status.PAID:
            return Response({"detail": "Invoice already paid."}, status=400)

        # Stripe amounts are in smallest currency unit (cents/fils)
        # AED, SAR use fils; EUR uses cents. All multiply by 100.
        amount_in_cents = int(invoice.total * 100)
        currency_map = {"AED": "aed", "SAR": "sar", "EUR": "eur"}
        stripe_currency = currency_map.get(invoice.currency, "usd")

        try:
            intent = stripe.PaymentIntent.create(
                amount=amount_in_cents,
                currency=stripe_currency,
                metadata={
                    "invoice_number": invoice.invoice_number,
                    "patient_email": request.user.email,
                },
                description=f"MediCore HMS — {invoice.invoice_number}",
            )
        except stripe.error.StripeError as e:
            return Response({"detail": str(e)}, status=400)

        return Response({
            "client_secret": intent.client_secret,
            "publishable_key": pub_key,
            "amount": str(invoice.total),
            "currency": invoice.currency,
        })


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
