from rest_framework import permissions, status, generics
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    LoginSerializer, RegisterSerializer,
    TokenResponseSerializer, UserSerializer, PatientProfileSerializer,
)
from .models import User, PatientProfile
from apps.accounts.permissions import IsAdminUser


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(TokenResponseSerializer.from_user(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return Response(TokenResponseSerializer.from_user(user), status=status.HTTP_200_OK)


class MeView(APIView):
    """GET = current user profile. PATCH = update own profile."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        # Update basic user fields
        user = request.user
        for field in ("first_name", "last_name", "phone_number", "language_preference", "timezone"):
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()

        # Update patient profile fields if PATIENT role
        if user.role == User.Role.PATIENT:
            profile = getattr(user, "patient_profile", None)
            if profile:
                profile_fields = [
                    "date_of_birth", "gender", "nationality", "national_id",
                    "address", "emergency_contact", "emergency_phone",
                    "blood_group", "allergies", "chronic_conditions",
                    "current_medications", "insurance_provider",
                    "insurance_number", "insurance_expiry",
                ]
                for field in profile_fields:
                    if field in request.data:
                        setattr(profile, field, request.data[field])
                profile.save()

        return Response(UserSerializer(user).data)


class PatientFullRecordView(APIView):
    """
    GET /api/v1/accounts/patients/<patient_id>/
    Returns FULL patient record — used by Doctor, Pharmacist, Admin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, patient_id):
        # Only staff can access other patients' records
        user = request.user
        allowed_roles = (User.Role.ADMIN, User.Role.DOCTOR, User.Role.PHARMACIST)

        try:
            profile = PatientProfile.objects.select_related("user").get(patient_id=patient_id)
        except PatientProfile.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=404)

        patient_user = profile.user

        # Patients can only view their own record
        if user.role == User.Role.PATIENT and user != patient_user:
            return Response({"detail": "Forbidden."}, status=403)

        # If doctor, only allow if they have at least one appointment with this patient
        if user.role == User.Role.DOCTOR:
            from apps.appointments.models import Appointment
            has_access = Appointment.objects.filter(
                doctor__user=user, patient=patient_user
            ).exists()
            if not has_access:
                return Response({"detail": "You have no appointments with this patient."}, status=403)

        # Build full record
        from apps.appointments.models import Appointment, Prescription, OPDVisit, XRayRequest
        from apps.billing.models import Invoice
        from apps.appointments.serializers import AppointmentSerializer
        from apps.billing.serializers import InvoiceSerializer

        appointments = Appointment.objects.filter(patient=patient_user).select_related(
            "doctor__user", "doctor__specialty"
        ).prefetch_related("prescription__items").order_by("-appointment_date", "-appointment_time")

        invoices = Invoice.objects.filter(patient=patient_user).order_by("-created_at")

        opd_visits = OPDVisit.objects.filter(
            patient_name__icontains=patient_user.get_full_name()
        ).order_by("-created_at")[:10] if patient_user.get_full_name() else []

        return Response({
            "patient_id":   patient_id,
            "user": {
                "id":         patient_user.id,
                "full_name":  patient_user.get_full_name(),
                "email":      patient_user.email,
                "phone":      patient_user.phone_number,
            },
            "profile": PatientProfileSerializer(profile).data,
            "appointments": AppointmentSerializer(appointments, many=True).data,
            "invoices": InvoiceSerializer(invoices, many=True).data,
            "summary": {
                "total_appointments": appointments.count(),
                "completed":  appointments.filter(status="COMPLETED").count(),
                "cancelled":  appointments.filter(status="CANCELLED").count(),
                "total_billed": sum(float(i.total) for i in invoices),
                "total_paid":   sum(float(i.amount_paid) for i in invoices),
            }
        })


class AllPatientsView(generics.ListAPIView):
    """
    GET /api/v1/accounts/patients/
    Admin: all patients. Doctor: their own patients only.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.filter(role=User.Role.PATIENT).select_related("patient_profile").order_by("-date_joined")

        if user.role == User.Role.DOCTOR:
            from apps.appointments.models import Appointment
            patient_ids = Appointment.objects.filter(
                doctor__user=user
            ).values_list("patient_id", flat=True).distinct()
            qs = qs.filter(id__in=patient_ids)

        search = self.request.query_params.get("search", "")
        if search:
            qs = qs.filter(
                first_name__icontains=search
            ) | qs.filter(email__icontains=search) | qs.filter(
                patient_profile__patient_id__icontains=search
            )
        return qs
