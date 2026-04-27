from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("listening", "0002_section_audio_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="listeningquestion",
            name="question_type",
            field=models.CharField(
                choices=[
                    ("gist", "Main idea (gist)"),
                    ("detail", "Details"),
                    ("inference", "Inference"),
                    ("purpose", "Purpose"),
                    ("response", "Response"),
                    ("other", "Other"),
                ],
                default="other",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="listeningquestion",
            index=models.Index(fields=["jlpt_level", "question_type"], name="listening_q_jlpt_le_25e28e_idx"),
        ),
    ]

