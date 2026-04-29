from rest_framework import generics, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from datetime import datetime, timedelta, date as date_type
from .models import Specialty, DoctorProfile
from .serializers import SpecialtySerializer, DoctorProfileSerializer
from apps.accounts.permissions import IsAdminUser


class SpecialtyListView(generics.ListCreateAPIView):
    queryset = Specialty.objects.all()
    serializer_class = SpecialtySerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [IsAdminUser()]


class DoctorListView(generics.ListAPIView):
    queryset = DoctorProfile.objects.filter(is_active=True).select_related("user", "specialty")
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ["specialty__name", "user__first_name", "user__last_name"]

    def get_queryset(self):
        qs = super().get_queryset()
        specialty_id = self.request.query_params.get("specialty")
        if specialty_id:
            qs = qs.filter(specialty_id=specialty_id)
        return qs


class DoctorDetailView(generics.RetrieveUpdateAPIView):
    queryset = DoctorProfile.objects.select_related("user", "specialty")
    serializer_class = DoctorProfileSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]


class MyDoctorProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.doctor_profile
            return Response(DoctorProfileSerializer(profile).data)
        except DoctorProfile.DoesNotExist:
            return Response({"detail": "Doctor profile not found."}, status=404)


class DoctorAvailableSlotsView(APIView):
    """
    GET /api/v1/doctors/<pk>/slots/?date=YYYY-MM-DD
    Returns list of available time slots for a doctor on a given date.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            doctor = DoctorProfile.objects.get(pk=pk, is_active=True)
        except DoctorProfile.DoesNotExist:
            return Response({"detail": "Doctor not found."}, status=404)

        date_str = request.query_params.get("date")
        if not date_str:
            return Response({"detail": "date query param required (YYYY-MM-DD)."}, status=400)

        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=400)

        # Reject past dates
        if target_date < date_type.today():
            return Response({"detail": "Cannot book past dates."}, status=400)

        # Build all possible slots from available_from → available_to
        slot_duration = timedelta(minutes=doctor.slot_duration_minutes)
        slots = []
        current = datetime.combine(target_date, doctor.available_from)
        end = datetime.combine(target_date, doctor.available_to)

        while current + slot_duration <= end:
            slots.append(current.time())
            current += slot_duration

        # Get already-booked slots for this doctor on this date
        from apps.appointments.models import Appointment
        booked_times = set(
            Appointment.objects.filter(
                doctor=doctor,
                appointment_date=target_date,
            ).exclude(
                status=Appointment.Status.CANCELLED
            ).values_list("appointment_time", flat=True)
        )

        available_slots = []
        for slot in slots:
            slot_str = slot.strftime("%H:%M")
            available_slots.append({
                "time": slot_str,
                "available": slot not in booked_times,
            })

        return Response({
            "doctor_id": doctor.id,
            "doctor_name": f"Dr. {doctor.user.get_full_name()}",
            "date": date_str,
            "available_from": doctor.available_from.strftime("%H:%M"),
            "available_to": doctor.available_to.strftime("%H:%M"),
            "slot_duration_minutes": doctor.slot_duration_minutes,
            "is_tele_health_enabled": doctor.is_tele_health_enabled,
            "slots": available_slots,
        })


# ── Admin Doctor CRUD ─────────────────────────────────────────────────────────

class DoctorAdminCreateView(APIView):
    """
    POST /api/v1/doctors/admin/create/
    Admin creates a new doctor user + profile in one call.
    Body: { first_name, last_name, email, specialty_id, license_number,
            consultation_fee_aed, available_from, available_to,
            slot_duration_minutes, is_tele_health_enabled,
            telehealth_discount_percent, bio }
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        from apps.accounts.models import User
        from django.db import transaction

        data = request.data
        email = data.get("email", "").strip().lower()
        first_name = data.get("first_name", "").strip()
        last_name = data.get("last_name", "").strip()

        if not email or not first_name:
            return Response({"detail": "email and first_name are required."}, status=400)

        if User.objects.filter(email=email).exists():
            return Response({"detail": "A user with this email already exists."}, status=400)

        try:
            specialty_id = int(data.get("specialty_id") or 0)
        except (ValueError, TypeError):
            specialty_id = None

        try:
            with transaction.atomic():
                # Create user account
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    password=data.get("password", "Doctor@1234"),
                    first_name=first_name,
                    last_name=last_name,
                    role=User.Role.DOCTOR,
                )

                # Create doctor profile
                profile_data = {
                    "user": user,
                    "license_number": data.get("license_number", f"LIC-{user.id:05d}"),
                    "bio": data.get("bio", ""),
                    "consultation_fee_aed": data.get("consultation_fee_aed", 200),
                    "consultation_fee_sar": data.get("consultation_fee_sar", 200),
                    "consultation_fee_eur": data.get("consultation_fee_eur", 50),
                    "available_from": data.get("available_from", "08:00"),
                    "available_to": data.get("available_to", "17:00"),
                    "slot_duration_minutes": data.get("slot_duration_minutes", 30),
                    "is_tele_health_enabled": data.get("is_tele_health_enabled", True),
                    "telehealth_discount_percent": data.get("telehealth_discount_percent", 20),
                }
                if specialty_id:
                    from .models import Specialty
                    try:
                        profile_data["specialty"] = Specialty.objects.get(pk=specialty_id)
                    except Specialty.DoesNotExist:
                        pass

                profile = DoctorProfile.objects.create(**profile_data)

        except Exception as e:
            return Response({"detail": str(e)}, status=400)

        return Response(DoctorProfileSerializer(profile).data, status=201)


class DoctorAdminDeleteView(APIView):
    """
    DELETE /api/v1/doctors/admin/<pk>/delete/
    Soft-deletes the doctor (is_active=False) and deactivates their user account.
    """
    permission_classes = [IsAdminUser]

    def delete(self, request, pk):
        try:
            profile = DoctorProfile.objects.get(pk=pk)
        except DoctorProfile.DoesNotExist:
            return Response({"detail": "Doctor not found."}, status=404)

        profile.is_active = False
        profile.save(update_fields=["is_active"])
        profile.user.is_active = False
        profile.user.save(update_fields=["is_active"])
        return Response({"detail": "Doctor deactivated successfully."}, status=200)


class AllDoctorsAdminView(generics.ListAPIView):
    """Admin view that includes inactive doctors too."""
    queryset = DoctorProfile.objects.select_related("user", "specialty").order_by("-created_at")
    serializer_class = DoctorProfileSerializer
    permission_classes = [IsAdminUser]
