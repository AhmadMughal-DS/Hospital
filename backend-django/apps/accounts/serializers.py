from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import PatientProfile, User


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    language_preference = serializers.ChoiceField(choices=["EN", "AR"], required=False, default="EN")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        full_name = validated_data["full_name"].strip()
        email = validated_data["email"].strip().lower()
        password = validated_data["password"]
        language_preference = validated_data.get("language_preference", "EN")

        username_seed = email.split("@")[0][:20]
        username = username_seed
        i = 1
        while User.objects.filter(username=username).exists():
            username = f"{username_seed}{i}"
            i += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=full_name,
            role=User.Role.PATIENT,
            language_preference=language_preference,
        )

        PatientProfile.objects.create(
            user=user,
            consent_version="v1",
            consent_given_at=timezone.now(),
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        password = attrs["password"]

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError("Invalid email or password.") from exc

        auth_user = authenticate(username=user.username, password=password)
        if not auth_user:
            raise serializers.ValidationError("Invalid email or password.")

        attrs["user"] = auth_user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    patient_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "role", "language_preference", "timezone", "patient_id"]

    def get_patient_id(self, obj):
        profile = getattr(obj, "patient_profile", None)
        return profile.patient_id if profile else None


class TokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()

    @staticmethod
    def from_user(user: User):
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }
