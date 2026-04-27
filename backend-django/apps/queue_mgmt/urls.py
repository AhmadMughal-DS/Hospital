from django.urls import path
from .views import QueueTokenListCreateView, CurrentQueueView, CallNextTokenView

urlpatterns = [
    path("tokens/", QueueTokenListCreateView.as_view(), name="queue-token-list"),
    path("tokens/current/", CurrentQueueView.as_view(), name="queue-current"),
    path("tokens/call-next/", CallNextTokenView.as_view(), name="queue-call-next"),
]
