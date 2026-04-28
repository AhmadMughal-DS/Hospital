from django.urls import path
from .views import (
    SpecialtyListView, DoctorListView, DoctorDetailView,
    MyDoctorProfileView, DoctorAvailableSlotsView
)

urlpatterns = [
    path("specialties/", SpecialtyListView.as_view(), name="specialty-list"),
    path("", DoctorListView.as_view(), name="doctor-list"),
    path("<int:pk>/", DoctorDetailView.as_view(), name="doctor-detail"),
    path("me/", MyDoctorProfileView.as_view(), name="doctor-me"),
    path("<int:pk>/slots/", DoctorAvailableSlotsView.as_view(), name="doctor-slots"),
]
