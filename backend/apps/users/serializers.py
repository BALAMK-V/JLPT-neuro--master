from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import StudyCompanion, UserAppearanceSettings, UserProfile


User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            "learning_type",
            "jlpt_level",
            "daily_goal_new_items",
            "session_minutes_preference",
            "reminders_enabled",
            "reminder_interval_minutes",
            "ui_prefs",
        ]


class MeSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_staff", "profile"]
        read_only_fields = ["is_staff"]

    def update(self, instance, validated_data):  # type: ignore[no-untyped-def]
        profile_data = validated_data.pop("profile", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if profile_data is not None:
            profile = instance.profile
            for key, value in profile_data.items():
                setattr(profile, key, value)
            profile.save()
        return instance


class UserAppearanceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAppearanceSettings
        fields = [
            "theme_mode",
            "font_family",
            "font_size",
            "font_weight",
            "font_color",
            "background_type",
            "background_value",
            "blur_level",
            "opacity",
            "border_radius",
            "shadow_level",
            "animation_level",
            "layout_density",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_blur_level(self, value):  # type: ignore[no-untyped-def]
        return max(0, min(24, value))

    def validate_opacity(self, value):  # type: ignore[no-untyped-def]
        return max(0.15, min(1, value))

    def validate_border_radius(self, value):  # type: ignore[no-untyped-def]
        return max(0, min(28, value))

    def validate_shadow_level(self, value):  # type: ignore[no-untyped-def]
        return max(0, min(4, value))


class StudyCompanionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyCompanion
        fields = ["character_type", "enabled", "position", "sound_enabled", "updated_at"]
        read_only_fields = ["updated_at"]
