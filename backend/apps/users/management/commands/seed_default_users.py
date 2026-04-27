import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.users.models import UserProfile


class Command(BaseCommand):
    help = "Create default admin + demo user (dev-only seeder)."

    def handle(self, *args, **options):  # type: ignore[no-untyped-def]
        if os.getenv("RUN_SEED", "0") != "1":
            self.stdout.write(self.style.WARNING("RUN_SEED!=1, skipping seeding."))
            return

        password = os.getenv("DEFAULT_SEED_PASSWORD", "Test@123")

        admin_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
        admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com")

        user_username = os.getenv("DEFAULT_USER_USERNAME", "demo")
        user_email = os.getenv("DEFAULT_USER_EMAIL", "demo@example.com")

        User = get_user_model()

        admin, _ = User.objects.get_or_create(username=admin_username, defaults={"email": admin_email})
        admin.email = admin_email or admin.email
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password(password)
        admin.save()
        UserProfile.objects.get_or_create(user=admin)

        user, _ = User.objects.get_or_create(username=user_username, defaults={"email": user_email})
        user.email = user_email or user.email
        user.is_staff = False
        user.is_superuser = False
        user.set_password(password)
        user.save()
        UserProfile.objects.get_or_create(user=user)

        self.stdout.write(self.style.SUCCESS("Seeded default users:"))
        self.stdout.write(f"- admin: {admin_username} / {password}")
        self.stdout.write(f"- demo:  {user_username} / {password}")
