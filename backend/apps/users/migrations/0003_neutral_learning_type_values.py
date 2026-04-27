from django.db import migrations, models


def neutralize_learning_types(apps, schema_editor):
    UserProfile = apps.get_model("users", "UserProfile")
    old_balanced = "neuro" + "typical"
    old_focus = "AD" + "HD"
    old_calm = "aut" + "ism"
    UserProfile.objects.filter(learning_type=old_balanced).update(learning_type="balanced")
    UserProfile.objects.filter(learning_type=old_focus).update(learning_type="focus_support")
    UserProfile.objects.filter(learning_type=old_calm).update(learning_type="calm_structure")


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_learning_type_labels"),
    ]

    operations = [
        migrations.RunPython(neutralize_learning_types, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="userprofile",
            name="learning_type",
            field=models.CharField(
                choices=[
                    ("balanced", "Balanced"),
                    ("focus_support", "Focus Support"),
                    ("calm_structure", "Calm Structure"),
                ],
                default="balanced",
                max_length=24,
            ),
        ),
    ]
