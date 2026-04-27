from django.urls import path
from .views import DrugListCreateView, DrugDetailView, StockMovementListCreateView, LowStockAlertView

urlpatterns = [
    path("drugs/", DrugListCreateView.as_view(), name="drug-list"),
    path("drugs/<int:pk>/", DrugDetailView.as_view(), name="drug-detail"),
    path("stock-movements/", StockMovementListCreateView.as_view(), name="stock-movement-list"),
    path("alerts/low-stock/", LowStockAlertView.as_view(), name="low-stock-alert"),
]
