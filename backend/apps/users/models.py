from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    class LearningType(models.TextChoices):
        BALANCED = "balanced", "Balanced"
        FOCUS_SUPPORT = "focus_support", "Focus Support"
        CALM_STRUCTURE = "calm_structure", "Calm Structure"

    class JLPTLevel(models.TextChoices):
        N5 = "N5", "N5"
        N4 = "N4", "N4"
        N3 = "N3", "N3"
        N2 = "N2", "N2"
        N1 = "N1", "N1"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    learning_type = models.CharField(max_length=24, choices=LearningType.choices, default=LearningType.BALANCED)
    jlpt_level = models.CharField(max_length=2, choices=JLPTLevel.choices, default=JLPTLevel.N2)

    daily_goal_new_items = models.PositiveIntegerField(default=20)
    session_minutes_preference = models.PositiveIntegerField(default=10)

    reminders_enabled = models.BooleanField(default=True)
    reminder_interval_minutes = models.PositiveIntegerField(default=25)

    ui_prefs = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Profile({self.user_id}, {self.learning_type}, {self.jlpt_level})"


class UserAppearanceSettings(models.Model):
    class ThemeMode(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        AUTO = "auto", "Auto"

    class FontFamily(models.TextChoices):
        SANS = "sans", "Sans"
        SERIF = "serif", "Serif"
        ROUNDED = "rounded", "Rounded"
        MONO = "mono", "Mono"

    class FontSize(models.TextChoices):
        SMALL = "small", "Small"
        MEDIUM = "medium", "Medium"
        LARGE = "large", "Large"

    class FontWeight(models.TextChoices):
        LIGHT = "light", "Light"
        NORMAL = "normal", "Normal"
        BOLD = "bold", "Bold"

    class BackgroundType(models.TextChoices):
        COLOR = "color", "Solid color"
        GRADIENT = "gradient", "Gradient"
        IMAGE = "image", "Image"

    class AnimationLevel(models.TextChoices):
        LOW = "low", "Low"
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"

    class LayoutDensity(models.TextChoices):
        COMPACT = "compact", "Compact"
        COMFORTABLE = "comfortable", "Comfortable"
        SPACIOUS = "spacious", "Spacious"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="appearance_settings")
    theme_mode = models.CharField(max_length=12, choices=ThemeMode.choices, default=ThemeMode.DARK)
    font_family = models.CharField(max_length=16, choices=FontFamily.choices, default=FontFamily.SANS)
    font_size = models.CharField(max_length=12, choices=FontSize.choices, default=FontSize.MEDIUM)
    font_weight = models.CharField(max_length=12, choices=FontWeight.choices, default=FontWeight.NORMAL)
    font_color = models.CharField(max_length=16, default="#f5f7fb")
    background_type = models.CharField(max_length=12, choices=BackgroundType.choices, default=BackgroundType.GRADIENT)
    background_value = models.JSONField(default=dict, blank=True)
    blur_level = models.PositiveSmallIntegerField(default=0)
    opacity = models.FloatField(default=1.0)
    border_radius = models.PositiveSmallIntegerField(default=14)
    shadow_level = models.PositiveSmallIntegerField(default=2)
    animation_level = models.CharField(max_length=12, choices=AnimationLevel.choices, default=AnimationLevel.NORMAL)
    layout_density = models.CharField(max_length=16, choices=LayoutDensity.choices, default=LayoutDensity.COMFORTABLE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Appearance({self.user_id})"


class StudyCompanion(models.Model):
    class CharacterType(models.TextChoices):
        DARUMA = "daruma", "Daruma"
        MANEKI = "maneki", "Maneki"
        KITSUNE = "kitsune", "Kitsune"
        TANUKI = "tanuki", "Tanuki"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_companion")
    character_type = models.CharField(max_length=16, choices=CharacterType.choices, default=CharacterType.DARUMA)
    enabled = models.BooleanField(default=True)
    position = models.JSONField(default=dict, blank=True)
    sound_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Companion({self.user_id}, {self.character_type})"
