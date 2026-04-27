from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("flashcards", "0002_rename_flashcards_c_deck_id_73eb1c_idx_flashcards__deck_id_616d58_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="deck",
            name="system_key",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="deck",
            name="is_locked",
            field=models.BooleanField(default=False),
        ),
        migrations.AddConstraint(
            model_name="card",
            constraint=models.UniqueConstraint(fields=("deck", "kanji"), name="uniq_card_deck_kanji"),
        ),
        migrations.AddConstraint(
            model_name="card",
            constraint=models.UniqueConstraint(fields=("deck", "vocab"), name="uniq_card_deck_vocab"),
        ),
    ]

