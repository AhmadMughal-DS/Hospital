from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import QueueToken
from .serializers import QueueTokenSerializer, QueueTokenCreateSerializer
from apps.accounts.models import User


class QueueTokenListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return QueueTokenCreateSerializer
        return QueueTokenSerializer

    def get_queryset(self):
        today = timezone.now().date()
        return QueueToken.objects.filter(queue_date=today).select_related(
            "patient", "doctor__user"
        ).order_by("token_number")

    def create(self, request, *args, **kwargs):
        serializer = QueueTokenCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.save()
        return Response(QueueTokenSerializer(token).data, status=status.HTTP_201_CREATED)


class CurrentQueueView(APIView):
    """Public endpoint — returns queue state for live display."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        today = timezone.now().date()
        current = QueueToken.objects.filter(
            queue_date=today,
            status=QueueToken.Status.IN_PROGRESS,
        ).order_by("-called_at").first()

        if not current:
            current = QueueToken.objects.filter(
                queue_date=today,
                status=QueueToken.Status.CALLED,
            ).order_by("-called_at").first()

        waiting_count = QueueToken.objects.filter(
            queue_date=today,
            status=QueueToken.Status.WAITING,
        ).count()

        queue = QueueToken.objects.filter(
            queue_date=today,
            status__in=[QueueToken.Status.WAITING, QueueToken.Status.CALLED, QueueToken.Status.IN_PROGRESS],
        ).order_by("token_number")

        return Response({
            "current": QueueTokenSerializer(current).data if current else None,
            "waiting_count": waiting_count,
            "queue": QueueTokenSerializer(queue, many=True).data,
        })


class CallNextTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role not in (User.Role.ADMIN, User.Role.DOCTOR):
            return Response({"detail": "Forbidden."}, status=403)
        today = timezone.now().date()
        # Mark current as completed
        QueueToken.objects.filter(queue_date=today, status=QueueToken.Status.IN_PROGRESS).update(
            status=QueueToken.Status.COMPLETED,
            completed_at=timezone.now(),
        )
        # Call next waiting
        next_token = QueueToken.objects.filter(
            queue_date=today,
            status=QueueToken.Status.WAITING,
        ).order_by("is_priority" if False else "-is_priority", "token_number").first()

        if not next_token:
            return Response({"detail": "No more patients in queue."})

        next_token.status = QueueToken.Status.CALLED
        next_token.called_at = timezone.now()
        next_token.save()
        return Response(QueueTokenSerializer(next_token).data)
