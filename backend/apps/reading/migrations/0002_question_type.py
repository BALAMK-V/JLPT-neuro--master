from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reading", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="readingquestion",
            name="question_type",
            field=models.CharField(
                choices=[
                    ("main_idea", "Main idea"),
                    ("detail", "Detail"),
                    ("inference", "Inference"),
                    ("purpose", "Purpose"),
                    ("vocab", "Vocabulary in context"),
                    ("reference", "Reference / pronoun"),
                    ("info_search", "Information search"),
                    ("other", "Other"),
                ],
                default="other",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="readingquestion",
            index=models.Index(fields=["question_type"], name="reading_que_question_41b4fd_idx"),
        ),
    ]

