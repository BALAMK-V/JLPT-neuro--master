"""
Idempotent seeder: creates/resets the three demo accounts.

    admin  / Test@123  — superuser + is_staff (full access)
    bala   / Test@123  — is_staff only (management user)
    demo   / Test@123  — regular learner

Run automatically from Dockerfile CMD on every container start.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.users.models import UserProfile


class Command(BaseCommand):
    help = "Seed admin, bala (management), and demo users."

    def handle(self, *args, **options):  # type: ignore[no-untyped-def]
        User = get_user_model()
        password = "Test@123"

        specs = [
            {"username": "admin",  "email": "admin@jlpt.local",  "is_staff": True,  "is_superuser": True},
            {"username": "bala",   "email": "bala@jlpt.local",   "is_staff": True,  "is_superuser": False},
            {"username": "demo",   "email": "demo@jlpt.local",   "is_staff": False, "is_superuser": False},
        ]

        for spec in specs:
            user, created = User.objects.get_or_create(
                username=spec["username"],
                defaults={"email": spec["email"]},
            )
            user.email = spec["email"]
            user.is_staff = spec["is_staff"]
            user.is_superuser = spec["is_superuser"]
            user.set_password(password)
            user.save()
            UserProfile.objects.get_or_create(user=user)

            verb = "Created" if created else "Updated"
            role = "superuser" if spec["is_superuser"] else ("management" if spec["is_staff"] else "learner")
            self.stdout.write(self.style.SUCCESS(f"{verb}: {spec['username']} ({role}) / {password}"))
