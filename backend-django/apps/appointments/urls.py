from django.urls import path
from .views import (
    AppointmentListCreateView, AppointmentDetailView,
    TodayQueueView, PrescriptionCreateView, PrescriptionDetailView,
    OPDVisitListCreateView, OPDVisitDetailView,
    XRayRequestListCreateView, XRayRequestDetailView,
)

urlpatterns = [
    path("", AppointmentListCreateView.as_view(), name="appointment-list"),
    path("<int:pk>/", AppointmentDetailView.as_view(), name="appointment-detail"),
    path("today-queue/", TodayQueueView.as_view(), name="today-queue"),
    path("<int:appointment_id>/prescription/", PrescriptionCreateView.as_view(), name="prescription-create"),
    path("prescriptions/<int:pk>/", PrescriptionDetailView.as_view(), name="prescription-detail"),
    # OPD
    path("opd/", OPDVisitListCreateView.as_view(), name="opd-list"),
    path("opd/<int:pk>/", OPDVisitDetailView.as_view(), name="opd-detail"),
    # Radiology
    path("xray/", XRayRequestListCreateView.as_view(), name="xray-list"),
    path("xray/<int:pk>/", XRayRequestDetailView.as_view(), name="xray-detail"),
]
