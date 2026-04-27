from django.urls import path
from .views import (
    AppointmentListCreateView, AppointmentDetailView,
    TodayQueueView, PrescriptionCreateView, PrescriptionDetailView
)

urlpatterns = [
    path("", AppointmentListCreateView.as_view(), name="appointment-list"),
    path("<int:pk>/", AppointmentDetailView.as_view(), name="appointment-detail"),
    path("today-queue/", TodayQueueView.as_view(), name="today-queue"),
    path("<int:appointment_id>/prescription/", PrescriptionCreateView.as_view(), name="prescription-create"),
    path("prescriptions/<int:pk>/", PrescriptionDetailView.as_view(), name="prescription-detail"),
]
