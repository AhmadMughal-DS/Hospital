from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import Appointment, Prescription, PrescriptionItem
from .serializers import (
    AppointmentSerializer, AppointmentCreateSerializer,
    PrescriptionSerializer, PrescriptionItemSerializer
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
        qs = Appointment.objects.select_related("patient", "doctor__user", "doctor__specialty")
        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        elif user.role == User.Role.ADMIN:
            return qs.all()
        return qs.filter(patient=user)

    def create(self, request, *args, **kwargs):
        serializer = AppointmentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        appointment = serializer.save()
        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)


class AppointmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Appointment.objects.select_related("patient", "doctor__user", "doctor__specialty")
        if user.role == User.Role.ADMIN:
            return qs.all()
        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        return qs.filter(patient=user)


class TodayQueueView(APIView):
    """Doctor sees today's appointment queue."""
    permission_classes = [IsDoctorUser]

    def get(self, request):
        today = timezone.now().date()
        appointments = Appointment.objects.filter(
            doctor__user=request.user,
            appointment_date=today,
        ).exclude(status=Appointment.Status.CANCELLED).order_by("appointment_time")
        return Response(AppointmentSerializer(appointments, many=True).data)


class PrescriptionCreateView(generics.CreateAPIView):
    """Doctor creates a prescription for an appointment."""
    permission_classes = [IsDoctorUser]

    def post(self, request, appointment_id):
        try:
            appointment = Appointment.objects.get(pk=appointment_id, doctor__user=request.user)
        except Appointment.DoesNotExist:
            return Response({"detail": "Appointment not found."}, status=404)

        if hasattr(appointment, "prescription"):
            return Response({"detail": "Prescription already exists."}, status=400)

        items_data = request.data.get("items", [])
        notes = request.data.get("notes", "")
        prescription = Prescription.objects.create(appointment=appointment, notes=notes)
        for item in items_data:
            PrescriptionItem.objects.create(prescription=prescription, **item)

        return Response(PrescriptionSerializer(prescription).data, status=201)


class PrescriptionDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PrescriptionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Prescription.objects.select_related("appointment__patient", "appointment__doctor__user")
        if user.role == User.Role.ADMIN:
            return qs.all()
        if user.role == User.Role.DOCTOR:
            return qs.filter(appointment__doctor__user=user)
        if user.role == User.Role.PHARMACIST:
            return qs.all()
        return qs.filter(appointment__patient=user)
