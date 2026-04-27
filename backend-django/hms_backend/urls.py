from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    # Core modules
    path("api/v1/doctors/", include("apps.doctors.urls")),
    path("api/v1/appointments/", include("apps.appointments.urls")),
    path("api/v1/pharmacy/", include("apps.pharmacy.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),
    path("api/v1/queue/", include("apps.queue_mgmt.urls")),
]
