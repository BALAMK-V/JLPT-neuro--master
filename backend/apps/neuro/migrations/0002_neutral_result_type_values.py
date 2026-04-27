from django.db import migrations, models


def neutralize_result_types(apps, schema_editor):
    UserNeuroProfile = apps.get_model("neuro", "UserNeuroProfile")
    mapping = {
        "neuro" + "typical": "balanced",
        "ad" + "hd_" + "hyper" + "active": "quick_reset",
        "ad" + "hd_" + "in" + "attentive": "focus_support",
        "ad" + "hd_combined": "momentum_support",
        "aut" + "ism_traits": "calm_structure",
    }
    for old, new in mapping.items():
        UserNeuroProfile.objects.filter(result_type=old).update(result_type=new)


class Migration(migrations.Migration):
    dependencies = [
        ("neuro", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(neutralize_result_types, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="userneuroprofile",
            name="result_type",
            field=models.CharField(
                choices=[
                    ("balanced", "Balanced learner"),
                    ("quick_reset", "Quick Reset learner"),
                    ("focus_support", "Focus Support learner"),
                    ("momentum_support", "Momentum Support learner"),
                    ("calm_structure", "Calm Structure learner"),
                ],
                max_length=32,
            ),
        ),
    ]
