from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("listening", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="listeningquestion",
            name="audio_text",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="listeningquestion",
            name="section",
            field=models.CharField(
                choices=[
                    ("kadai", "課題理解"),
                    ("point", "ポイント理解"),
                    ("gaiyo", "概要理解"),
                    ("sokuji", "即時応答"),
                    ("togo", "統合理解"),
                    ("other", "Other"),
                ],
                default="other",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="listeningquestion",
            index=models.Index(fields=["jlpt_level", "section"], name="listening_l_jlpt_se_6d52f9_idx"),
        ),
    ]
