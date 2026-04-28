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
