from rest_framework import generics, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
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
