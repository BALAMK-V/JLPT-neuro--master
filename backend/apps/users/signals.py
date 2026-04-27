from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.utils import OperationalError, ProgrammingError

from .models import StudyCompanion, UserAppearanceSettings, UserProfile


User = get_user_model()


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):  # type: ignore[no-untyped-def]
    if created:
        try:
            UserProfile.objects.create(user=instance)
            UserAppearanceSettings.objects.create(user=instance)
            StudyCompanion.objects.create(user=instance)
        except (OperationalError, ProgrammingError):
            # Migrations may not have run yet (e.g. first boot).
            return



