from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def create_defaults(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserAppearanceSettings = apps.get_model("users", "UserAppearanceSettings")
    StudyCompanion = apps.get_model("users", "StudyCompanion")
    for user in User.objects.all():
        UserAppearanceSettings.objects.get_or_create(user=user)
        StudyCompanion.objects.get_or_create(user=user)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0003_neutral_learning_type_values"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserAppearanceSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("theme_mode", models.CharField(choices=[("light", "Light"), ("dark", "Dark"), ("auto", "Auto")], default="dark", max_length=12)),
                ("font_family", models.CharField(choices=[("sans", "Sans"), ("serif", "Serif"), ("rounded", "Rounded"), ("mono", "Mono")], default="sans", max_length=16)),
                ("font_size", models.CharField(choices=[("small", "Small"), ("medium", "Medium"), ("large", "Large")], default="medium", max_length=12)),
                ("font_weight", models.CharField(choices=[("light", "Light"), ("normal", "Normal"), ("bold", "Bold")], default="normal", max_length=12)),
                ("font_color", models.CharField(default="#f5f7fb", max_length=16)),
                ("background_type", models.CharField(choices=[("color", "Solid color"), ("gradient", "Gradient"), ("image", "Image")], default="gradient", max_length=12)),
                ("background_value", models.JSONField(blank=True, default=dict)),
                ("blur_level", models.PositiveSmallIntegerField(default=0)),
                ("opacity", models.FloatField(default=1.0)),
                ("border_radius", models.PositiveSmallIntegerField(default=14)),
                ("shadow_level", models.PositiveSmallIntegerField(default=2)),
                ("animation_level", models.CharField(choices=[("low", "Low"), ("normal", "Normal"), ("high", "High")], default="normal", max_length=12)),
                ("layout_density", models.CharField(choices=[("compact", "Compact"), ("comfortable", "Comfortable"), ("spacious", "Spacious")], default="comfortable", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="appearance_settings", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="StudyCompanion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("character_type", models.CharField(choices=[("daruma", "Daruma"), ("maneki", "Maneki"), ("kitsune", "Kitsune"), ("tanuki", "Tanuki")], default="daruma", max_length=16)),
                ("enabled", models.BooleanField(default=True)),
                ("position", models.JSONField(blank=True, default=dict)),
                ("sound_enabled", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="study_companion", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.RunPython(create_defaults, migrations.RunPython.noop),
    ]
