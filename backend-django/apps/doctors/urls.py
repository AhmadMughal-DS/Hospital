from django.urls import path
from .views import SpecialtyListView, DoctorListView, DoctorDetailView, MyDoctorProfileView

urlpatterns = [
    path("specialties/", SpecialtyListView.as_view(), name="specialty-list"),
    path("", DoctorListView.as_view(), name="doctor-list"),
    path("<int:pk>/", DoctorDetailView.as_view(), name="doctor-detail"),
    path("me/", MyDoctorProfileView.as_view(), name="doctor-me"),
]
