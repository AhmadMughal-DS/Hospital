from django.urls import path
from .views import (
    SpecialtyListView, DoctorListView, DoctorDetailView,
    MyDoctorProfileView, DoctorAvailableSlotsView,
    DoctorAdminCreateView, DoctorAdminDeleteView, AllDoctorsAdminView,
)

urlpatterns = [
    path("specialties/", SpecialtyListView.as_view(), name="specialty-list"),
    path("", DoctorListView.as_view(), name="doctor-list"),
    path("admin-all/", AllDoctorsAdminView.as_view(), name="doctor-admin-list"),
    path("admin/create/", DoctorAdminCreateView.as_view(), name="doctor-admin-create"),
    path("admin/<int:pk>/delete/", DoctorAdminDeleteView.as_view(), name="doctor-admin-delete"),
    path("<int:pk>/", DoctorDetailView.as_view(), name="doctor-detail"),
    path("me/", MyDoctorProfileView.as_view(), name="doctor-me"),
    path("<int:pk>/slots/", DoctorAvailableSlotsView.as_view(), name="doctor-slots"),
]
