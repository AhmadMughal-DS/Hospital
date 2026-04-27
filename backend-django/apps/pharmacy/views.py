from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Drug, StockMovement
from .serializers import DrugSerializer, StockMovementSerializer
from apps.accounts.permissions import IsAdminUser, IsPharmacistUser


class IsPharmacistOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("PHARMACIST", "ADMIN")


class DrugListCreateView(generics.ListCreateAPIView):
    queryset = Drug.objects.filter(is_active=True).order_by("name")
    serializer_class = DrugSerializer
    permission_classes = [IsPharmacistOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        low_stock = self.request.query_params.get("low_stock")
        if low_stock == "true":
            qs = [d for d in qs if d.is_low_stock]
        return qs


class DrugDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Drug.objects.all()
    serializer_class = DrugSerializer
    permission_classes = [IsPharmacistOrAdmin]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


class StockMovementListCreateView(generics.ListCreateAPIView):
    serializer_class = StockMovementSerializer
    permission_classes = [IsPharmacistOrAdmin]

    def get_queryset(self):
        qs = StockMovement.objects.select_related("drug").order_by("-created_at")
        drug_id = self.request.query_params.get("drug")
        if drug_id:
            qs = qs.filter(drug_id=drug_id)
        return qs


class LowStockAlertView(APIView):
    permission_classes = [IsPharmacistOrAdmin]

    def get(self, request):
        drugs = [d for d in Drug.objects.filter(is_active=True) if d.is_low_stock]
        return Response(DrugSerializer(drugs, many=True).data)
