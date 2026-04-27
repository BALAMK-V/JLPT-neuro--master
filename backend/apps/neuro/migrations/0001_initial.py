from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


QUESTIONS = [
    (
        "How often do you lose track of time while studying Japanese?",
        "focus",
        [
            ("Rarely", {"focus": 1, "attention_span": 4, "consistency": 3}),
            ("Sometimes", {"focus": 2, "attention_span": 3, "distraction": 2}),
            ("Often", {"focus": 4, "attention_span": 2, "distraction": 3}),
            ("Almost every session", {"focus": 5, "attention_span": 1, "distraction": 4}),
        ],
    ),
    (
        "Do you re-read the same sentence or grammar point multiple times?",
        "attention_span",
        [
            ("Almost never", {"attention_span": 5, "memory_retention": 4}),
            ("Sometimes", {"attention_span": 3, "memory_retention": 3}),
            ("Often", {"attention_span": 2, "memory_retention": 2, "distraction": 3}),
            ("Very often", {"attention_span": 1, "memory_retention": 1, "distraction": 5}),
        ],
    ),
    (
        "How easily do outside sounds, tabs, or notifications pull you away?",
        "distraction",
        [
            ("Not easily", {"distraction": 1, "attention_span": 5}),
            ("A little", {"distraction": 2, "attention_span": 4}),
            ("Quite easily", {"distraction": 4, "attention_span": 2}),
            ("Immediately", {"distraction": 5, "attention_span": 1, "sensory_preference": 3}),
        ],
    ),
    (
        "Which study flow feels most natural?",
        "structure",
        [
            ("Predictable order every time", {"structure": 5, "sensory_preference": 3, "consistency": 4}),
            ("Mostly structured with small choices", {"structure": 4, "consistency": 4}),
            ("Flexible based on mood", {"structure": 2, "focus": 3}),
            ("Random quick tasks", {"structure": 1, "focus": 4, "distraction": 3}),
        ],
    ),
    (
        "Do you feel overwhelmed when a screen shows too many options or details?",
        "sensory_preference",
        [
            ("Rarely", {"sensory_preference": 1, "attention_span": 4}),
            ("Sometimes", {"sensory_preference": 2, "structure": 2}),
            ("Often", {"sensory_preference": 4, "structure": 4}),
            ("Very often", {"sensory_preference": 5, "structure": 5, "attention_span": 2}),
        ],
    ),
    (
        "Do you hyperfocus on one topic and forget to move to the next task?",
        "focus",
        [
            ("Rarely", {"focus": 1, "consistency": 4}),
            ("Sometimes", {"focus": 2, "consistency": 3}),
            ("Often", {"focus": 4, "consistency": 2}),
            ("Very often", {"focus": 5, "consistency": 1, "distraction": 2}),
        ],
    ),
    (
        "How quickly do new words or kanji fade after studying?",
        "memory_retention",
        [
            ("They usually stick", {"memory_retention": 5, "consistency": 4}),
            ("After a day or two", {"memory_retention": 3, "consistency": 3}),
            ("Within hours", {"memory_retention": 2, "attention_span": 2}),
            ("Almost immediately", {"memory_retention": 1, "attention_span": 1, "distraction": 4}),
        ],
    ),
    (
        "How important is a predictable routine for feeling ready to study?",
        "structure",
        [
            ("Not important", {"structure": 1, "focus": 3}),
            ("Somewhat important", {"structure": 3, "consistency": 3}),
            ("Very important", {"structure": 5, "consistency": 4, "sensory_preference": 3}),
            ("Essential", {"structure": 5, "sensory_preference": 5}),
        ],
    ),
    (
        "How often do you start lessons but struggle to finish them?",
        "consistency",
        [
            ("Rarely", {"consistency": 5, "attention_span": 4}),
            ("Sometimes", {"consistency": 3, "attention_span": 3}),
            ("Often", {"consistency": 2, "distraction": 4}),
            ("Almost always", {"consistency": 1, "distraction": 5, "attention_span": 1}),
        ],
    ),
    (
        "Which format helps you learn fastest?",
        "sensory_preference",
        [
            ("Text explanations", {"sensory_preference": 2, "structure": 3}),
            ("Visual examples", {"sensory_preference": 3, "memory_retention": 4}),
            ("Audio and shadowing", {"sensory_preference": 3, "focus": 3}),
            ("Short mixed tasks", {"focus": 4, "attention_span": 3}),
        ],
    ),
    (
        "When a task is boring, what usually happens?",
        "attention_span",
        [
            ("I can still finish", {"attention_span": 5, "consistency": 5}),
            ("I slow down", {"attention_span": 3, "consistency": 3}),
            ("I switch tabs or tasks", {"attention_span": 2, "distraction": 4}),
            ("I abandon it quickly", {"attention_span": 1, "distraction": 5, "consistency": 1}),
        ],
    ),
    (
        "How do you react to sudden changes in lesson order or interface layout?",
        "structure",
        [
            ("No problem", {"structure": 1, "sensory_preference": 1}),
            ("Small pause, then fine", {"structure": 2, "sensory_preference": 2}),
            ("It disrupts me", {"structure": 4, "sensory_preference": 4}),
            ("It can stop my session", {"structure": 5, "sensory_preference": 5, "consistency": 2}),
        ],
    ),
    (
        "How often do you need reminders to return to studying?",
        "consistency",
        [
            ("Rarely", {"consistency": 5, "attention_span": 4}),
            ("Sometimes", {"consistency": 3, "distraction": 2}),
            ("Often", {"consistency": 2, "distraction": 4}),
            ("Daily", {"consistency": 1, "distraction": 5, "attention_span": 2}),
        ],
    ),
    (
        "What session length feels most realistic on an average day?",
        "attention_span",
        [
            ("25 minutes or more", {"attention_span": 5, "consistency": 4}),
            ("15-20 minutes", {"attention_span": 4, "consistency": 4}),
            ("8-12 minutes", {"attention_span": 2, "distraction": 3}),
            ("Under 5 minutes", {"attention_span": 1, "distraction": 5, "consistency": 2}),
        ],
    ),
    (
        "Which support would make Japanese study feel calmer?",
        "sensory_preference",
        [
            ("More challenge", {"focus": 4, "attention_span": 4}),
            ("Progress checkpoints", {"consistency": 4, "memory_retention": 3}),
            ("Fewer choices per screen", {"sensory_preference": 5, "structure": 4}),
            ("More cues and reminders", {"distraction": 4, "consistency": 2}),
        ],
    ),
]


def seed_questions(apps, schema_editor):
    NeuroQuestion = apps.get_model("neuro", "NeuroQuestion")
    NeuroOption = apps.get_model("neuro", "NeuroOption")

    for index, (text, trait_key, options) in enumerate(QUESTIONS, start=1):
        question, _ = NeuroQuestion.objects.get_or_create(
            order=index,
            defaults={"question_text": text, "type": "mcq", "trait_key": trait_key, "is_active": True},
        )
        for option_index, (option_text, weights) in enumerate(options, start=1):
            NeuroOption.objects.get_or_create(
                question=question,
                order=option_index,
                defaults={"text": option_text, "value": option_index, "weight_mapping": weights},
            )


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="NeuroQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question_text", models.TextField()),
                ("type", models.CharField(choices=[("scale", "Scale"), ("mcq", "Multiple choice")], default="scale", max_length=12)),
                ("order", models.PositiveIntegerField(default=0)),
                ("trait_key", models.CharField(blank=True, max_length=40)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"ordering": ["order", "id"]},
        ),
        migrations.CreateModel(
            name="UserNeuroProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("result_type", models.CharField(choices=[("balanced", "Balanced learner"), ("quick_reset", "Quick Reset learner"), ("focus_support", "Focus Support learner"), ("momentum_support", "Momentum Support learner"), ("calm_structure", "Calm Structure learner")], max_length=32)),
                ("trait_scores", models.JSONField(default=dict)),
                ("summary", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="neuro_profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="NeuroOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.CharField(max_length=180)),
                ("value", models.PositiveSmallIntegerField(default=0)),
                ("weight_mapping", models.JSONField(default=dict)),
                ("order", models.PositiveIntegerField(default=0)),
                ("question", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="options", to="neuro.neuroquestion")),
            ],
            options={"ordering": ["order", "id"]},
        ),
        migrations.CreateModel(
            name="UserNeuroAnswer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("score", models.JSONField(default=dict)),
                ("answered_at", models.DateTimeField(auto_now_add=True)),
                ("question", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="neuro.neuroquestion")),
                ("selected_option", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="neuro.neurooption")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="neuro_answers", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(model_name="userneuroanswer", index=models.Index(fields=["user", "question"], name="neuro_usern_user_id_f2a1b3_idx")),
        migrations.AddIndex(model_name="userneuroanswer", index=models.Index(fields=["user", "answered_at"], name="neuro_usern_user_id_597de2_idx")),
        migrations.RunPython(seed_questions, migrations.RunPython.noop),
    ]
