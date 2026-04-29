from rest_framework import serializers
from .models import PatientProfile, User


class PatientProfileSerializer(serializers.ModelSerializer):
    """Full patient clinical profile."""
    class Meta:
        model = PatientProfile
        fields = [
            "patient_id", "date_of_birth", "gender", "nationality",
            "national_id", "address", "emergency_contact", "emergency_phone",
            "blood_group", "allergies", "chronic_conditions", "current_medications",
            "insurance_provider", "insurance_number", "insurance_expiry",
            "consent_version", "consent_given_at", "created_at", "updated_at",
        ]
        read_only_fields = ["patient_id", "created_at", "updated_at"]


class UserSerializer(serializers.ModelSerializer):
    patient_id = serializers.SerializerMethodField()
    profile    = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name",
            "role", "phone_number", "language_preference", "timezone",
            "patient_id", "profile",
        ]

    def get_patient_id(self, obj):
        profile = getattr(obj, "patient_profile", None)
        return profile.patient_id if profile else None

    def get_profile(self, obj):
        profile = getattr(obj, "patient_profile", None)
        if profile:
            return PatientProfileSerializer(profile).data
        return None


class RegisterSerializer(serializers.Serializer):
    full_name           = serializers.CharField(max_length=150)
    email               = serializers.EmailField()
    password            = serializers.CharField(write_only=True, min_length=8)
    language_preference = serializers.ChoiceField(choices=["en", "ar", "EN", "AR"], required=False, default="en")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        from django.utils import timezone as tz
        full_name = validated_data["full_name"].strip()
        email     = validated_data["email"].strip().lower()
        password  = validated_data["password"]
        lang      = validated_data.get("language_preference", "en")

        username_seed = email.split("@")[0][:20]
        username = username_seed
        i = 1
        while User.objects.filter(username=username).exists():
            username = f"{username_seed}{i}"
            i += 1

        name_parts = full_name.split(" ", 1)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=name_parts[0],
            last_name=name_parts[1] if len(name_parts) > 1 else "",
            role=User.Role.PATIENT,
            language_preference=lang,
        )

        PatientProfile.objects.create(
            user=user,
            consent_version="v1",
            consent_given_at=tz.now(),
        )
        return user


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        from django.contrib.auth import authenticate
        email    = attrs["email"].strip().lower()
        password = attrs["password"]

        # USERNAME_FIELD is 'email', so authenticate() must receive email=
        auth_user = authenticate(email=email, password=password)
        if not auth_user:
            raise serializers.ValidationError("Invalid email or password.")
        if not auth_user.is_active:
            raise serializers.ValidationError("Account is disabled. Please contact support.")

        attrs["user"] = auth_user
        return attrs


class TokenResponseSerializer(serializers.Serializer):
    access  = serializers.CharField()
    refresh = serializers.CharField()
    user    = UserSerializer()

    @staticmethod
    def from_user(user: User):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        return {
            "access":  str(refresh.access_token),
            "refresh": str(refresh),
            "user":    UserSerializer(user).data,
        }
