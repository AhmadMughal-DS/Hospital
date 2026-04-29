from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import Appointment, Prescription, PrescriptionItem
from .serializers import (
    AppointmentSerializer, AppointmentCreateSerializer,
    AppointmentClinicalUpdateSerializer,
    PrescriptionSerializer, PrescriptionItemSerializer,
)
from apps.accounts.models import User
from apps.accounts.permissions import IsAdminUser, IsDoctorUser


class AppointmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AppointmentCreateSerializer
        return AppointmentSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Appointment.objects.select_related(
            "patient__patient_profile", "doctor__user", "doctor__specialty"
        ).prefetch_related("prescription__items")

        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        elif user.role == User.Role.ADMIN:
            return qs.all()
        return qs.filter(patient=user)

    def create(self, request, *args, **kwargs):
        serializer = AppointmentCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        appointment = serializer.save()
        return Response(
            AppointmentSerializer(appointment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AppointmentDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        user = self.request.user
        if self.request.method in ("PUT", "PATCH"):
            if user.role in (User.Role.DOCTOR, User.Role.ADMIN):
                return AppointmentClinicalUpdateSerializer
        return AppointmentSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Appointment.objects.select_related(
            "patient__patient_profile", "doctor__user", "doctor__specialty"
        ).prefetch_related("prescription__items")
        if user.role == User.Role.ADMIN:
            return qs.all()
        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        return qs.filter(patient=user)

    def perform_update(self, serializer):
        instance = serializer.save()
        # If cancelled, stamp cancelled_at
        if instance.status == Appointment.Status.CANCELLED and not instance.cancelled_at:
            instance.cancelled_at = timezone.now()
            instance.save(update_fields=["cancelled_at"])

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return Response(
            AppointmentSerializer(instance, context={"request": request}).data
        )


class TodayQueueView(APIView):
    """Doctor sees today's appointment queue with full patient data."""
    permission_classes = [IsDoctorUser]

    def get(self, request):
        today = timezone.now().date()
        appointments = Appointment.objects.filter(
            doctor__user=request.user,
            appointment_date=today,
        ).exclude(
            status=Appointment.Status.CANCELLED
        ).select_related(
            "patient__patient_profile", "doctor__user", "doctor__specialty"
        ).prefetch_related("prescription__items").order_by("appointment_time")

        return Response(
            AppointmentSerializer(appointments, many=True, context={"request": request}).data
        )


class PrescriptionCreateView(APIView):
    """Doctor creates/updates a prescription for an appointment."""
    permission_classes = [IsDoctorUser]

    def post(self, request, appointment_id):
        try:
            appointment = Appointment.objects.get(pk=appointment_id, doctor__user=request.user)
        except Appointment.DoesNotExist:
            return Response({"detail": "Appointment not found."}, status=404)

        if hasattr(appointment, "prescription"):
            return Response({"detail": "Prescription already exists. Use PATCH to update."}, status=400)

        items_data = request.data.get("items", [])
        notes      = request.data.get("notes", "")
        diagnosis  = request.data.get("diagnosis", "")

        prescription = Prescription.objects.create(
            appointment=appointment, notes=notes, diagnosis=diagnosis
        )
        for item in items_data:
            PrescriptionItem.objects.create(prescription=prescription, **{
                k: v for k, v in item.items()
                if k in ("drug_name", "dosage", "frequency", "duration_days", "instructions", "quantity")
            })

        # Also update appointment diagnosis
        if diagnosis:
            appointment.diagnosis = diagnosis
            appointment.save(update_fields=["diagnosis"])

        return Response(PrescriptionSerializer(prescription).data, status=201)

    def patch(self, request, appointment_id):
        """Update existing prescription items."""
        try:
            appointment = Appointment.objects.get(pk=appointment_id, doctor__user=request.user)
            prescription = appointment.prescription
        except (Appointment.DoesNotExist, Prescription.DoesNotExist):
            return Response({"detail": "Prescription not found."}, status=404)

        notes     = request.data.get("notes", prescription.notes)
        diagnosis = request.data.get("diagnosis", prescription.diagnosis)
        prescription.notes     = notes
        prescription.diagnosis = diagnosis
        prescription.save()

        # Replace items if provided
        if "items" in request.data:
            prescription.items.all().delete()
            for item in request.data["items"]:
                PrescriptionItem.objects.create(prescription=prescription, **{
                    k: v for k, v in item.items()
                    if k in ("drug_name", "dosage", "frequency", "duration_days", "instructions", "quantity")
                })

        return Response(PrescriptionSerializer(prescription).data)


class PrescriptionDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = PrescriptionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Prescription.objects.select_related(
            "appointment__patient", "appointment__doctor__user"
        ).prefetch_related("items")
        if user.role == User.Role.ADMIN:
            return qs.all()
        if user.role == User.Role.DOCTOR:
            return qs.filter(appointment__doctor__user=user)
        if user.role == User.Role.PHARMACIST:
            return qs.all()
        return qs.filter(appointment__patient=user)


# ── OPD Views ─────────────────────────────────────────────────────────────────

from .models import OPDVisit, XRayRequest
from rest_framework import serializers as drf_serializers


class OPDVisitSerializer(drf_serializers.ModelSerializer):
    referring_doctor_name = drf_serializers.CharField(
        source="referring_doctor.user.get_full_name", read_only=True
    )

    class Meta:
        model = OPDVisit
        fields = [
            "id", "opd_ref", "patient_name", "patient_phone", "age", "gender",
            "reason", "bp", "temperature", "weight_kg", "pulse_rate", "oxygen_saturation",
            "referring_doctor", "referring_doctor_name",
            "linked_appointment",
            "status", "notes", "diagnosis", "visit_date", "created_at",
        ]
        read_only_fields = ["id", "opd_ref", "visit_date", "created_at"]


class IsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            "ADMIN", "DOCTOR", "PHARMACIST"
        )


class OPDVisitListCreateView(generics.ListCreateAPIView):
    serializer_class   = OPDVisitSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        qs = OPDVisit.objects.select_related("referring_doctor__user")
        if s := self.request.query_params.get("status"):
            qs = qs.filter(status=s)
        if self.request.query_params.get("today") == "true":
            qs = qs.filter(visit_date=timezone.now().date())
        return qs


class OPDVisitDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = OPDVisit.objects.select_related("referring_doctor__user")
    serializer_class   = OPDVisitSerializer
    permission_classes = [IsStaff]


# ── X-Ray Views ───────────────────────────────────────────────────────────────

class XRayRequestSerializer(drf_serializers.ModelSerializer):
    referring_doctor_name = drf_serializers.CharField(
        source="referring_doctor.user.get_full_name", read_only=True
    )

    class Meta:
        model = XRayRequest
        fields = [
            "id", "xray_ref", "patient_name", "patient_phone", "age", "gender",
            "xray_type", "clinical_history", "urgency",
            "referring_doctor", "referring_doctor_name",
            "linked_appointment",
            "status", "notes", "report",
            "reported_by", "reported_at", "requested_at",
        ]
        read_only_fields = ["id", "xray_ref", "requested_at"]


class XRayRequestListCreateView(generics.ListCreateAPIView):
    serializer_class   = XRayRequestSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        qs = XRayRequest.objects.select_related("referring_doctor__user")
        if s := self.request.query_params.get("status"):
            qs = qs.filter(status=s)
        return qs


class XRayRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = XRayRequest.objects.select_related("referring_doctor__user")
    serializer_class   = XRayRequestSerializer
    permission_classes = [IsStaff]
