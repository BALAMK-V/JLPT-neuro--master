import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from apps.audit import audit_log
from apps.users.models import StudyCompanion, UserAppearanceSettings, UserProfile

from .permissions import IsManagementUser
from .serializers import MeSerializer, StudyCompanionSerializer, UserAppearanceSettingsSerializer

User = get_user_model()

logger = logging.getLogger(__name__)


class AuthRateThrottle(AnonRateThrottle):
    """Tight rate limit for authentication endpoints (login/register)."""
    scope = "auth"


class PasswordResetThrottle(AnonRateThrottle):
    """Very tight rate limit for password-reset initiation to prevent enumeration."""
    scope = "password_reset"


class MeView(APIView):
    """
    Retrieve or partially update the authenticated user's own profile.

    GET  /api/auth/me/   — returns full profile via MeSerializer
    PATCH /api/auth/me/  — partial update (username, email, profile fields)
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):  # type: ignore[no-untyped-def]
        UserProfile.objects.get_or_create(user=request.user)
        return Response(MeSerializer(request.user).data)

    def patch(self, request):  # type: ignore[no-untyped-def]
        UserProfile.objects.get_or_create(user=request.user)
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def default_background_value():
    return {"from": "#0b1020", "to": "#11263f", "angle": 180}


class AppearanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, user):  # type: ignore[no-untyped-def]
        obj, created = UserAppearanceSettings.objects.get_or_create(user=user)
        if created and not obj.background_value:
            obj.background_value = default_background_value()
            obj.save(update_fields=["background_value"])
        return obj

    def get(self, request):  # type: ignore[no-untyped-def]
        return Response(UserAppearanceSettingsSerializer(self.get_object(request.user)).data)


class AppearanceUpdateView(AppearanceView):
    def post(self, request):  # type: ignore[no-untyped-def]
        obj = self.get_object(request.user)
        serializer = UserAppearanceSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AppearanceResetView(AppearanceView):
    def post(self, request):  # type: ignore[no-untyped-def]
        UserAppearanceSettings.objects.filter(user=request.user).delete()
        obj = UserAppearanceSettings.objects.create(user=request.user, background_value=default_background_value())
        return Response(UserAppearanceSettingsSerializer(obj).data)


class CompanionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, user):  # type: ignore[no-untyped-def]
        obj, created = StudyCompanion.objects.get_or_create(user=user)
        if created and not obj.position:
            obj.position = {"x": 24, "y": 24, "corner": "bottom-right"}
            obj.save(update_fields=["position"])
        return obj

    def get(self, request):  # type: ignore[no-untyped-def]
        return Response(StudyCompanionSerializer(self.get_object(request.user)).data)


class CompanionUpdateView(CompanionView):
    def post(self, request):  # type: ignore[no-untyped-def]
        obj = self.get_object(request.user)
        serializer = StudyCompanionSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class RegisterView(APIView):
    """
    Public endpoint to create a new learner account.

    Enforces unique username/email and minimum 8-character password.
    Rate-limited to prevent automated account creation.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):  # type: ignore[no-untyped-def]
        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip()
        password = request.data.get("password") or ""

        if not username or not password:
            return Response({"detail": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username is already taken."}, status=status.HTTP_400_BAD_REQUEST)
        if email and User.objects.filter(email=email).exists():
            return Response({"detail": "Email is already in use."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=password)
        UserProfile.objects.get_or_create(user=user)
        return Response({"detail": "Account created. You can now sign in."}, status=status.HTTP_201_CREATED)


class ChangePasswordView(APIView):
    """
    Change the current user's password.

    Verifies the existing password before applying the change.
    After a successful change the client must re-authenticate with new credentials.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):  # type: ignore[no-untyped-def]
        current = request.data.get("current_password") or ""
        new_pass = request.data.get("new_password") or ""

        if not request.user.check_password(current):
            return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_pass) < 8:
            return Response({"detail": "New password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_pass)
        request.user.save()
        return Response({"detail": "Password changed. Please sign in again."})


class ForgotPasswordView(APIView):
    """
    Initiate a password-reset flow.

    Always returns the same generic message to prevent email enumeration.
    In DEBUG mode the reset token is included in the response body for
    development convenience; in production only email delivery is used.
    Rate-limited to 5 requests/minute per IP.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        """Generate and dispatch a one-time password-reset token."""
        email = (request.data.get("email") or "").strip()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        GENERIC_MSG = "If an account with that email exists, reset instructions have been sent."
        try:
            user = User.objects.get(email=email)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            # TODO: send email via django.core.mail in production
            logger.info("Password reset requested for user id=%s", user.pk)
            response_data: dict = {"detail": GENERIC_MSG}
            # Expose reset params only in local dev — NEVER in production.
            if settings.DEBUG:
                response_data["dev_token"] = f"{uid}:{token}"
            return Response(response_data)
        except User.DoesNotExist:
            # Return identical message to prevent email enumeration.
            return Response({"detail": GENERIC_MSG})


class ResetPasswordView(APIView):
    """
    Consume a one-time password-reset token and set a new password.

    Validates the uid/token pair generated by ForgotPasswordView.
    Tokens are single-use and expire per Django's default_token_generator TTL
    (PASSWORD_RESET_TIMEOUT setting, default 3 days).
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):  # type: ignore[no-untyped-def]
        uid = (request.data.get("uid") or "").strip()
        token = (request.data.get("token") or "").strip()
        new_password = request.data.get("new_password") or ""

        if not uid or not token or not new_password:
            return Response({"detail": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except Exception:
            return Response({"detail": "Invalid or expired reset link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Reset link has expired or is invalid."}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Password has been reset. You can now sign in."})


class UserManagementListView(APIView):
    """
    List all users or create a new one (management staff only).

    GET  — returns all users ordered by join date.
    POST — creates a new user; the actor's action is written to the audit log.
    """

    permission_classes = [IsManagementUser]

    def get(self, request):  # type: ignore[no-untyped-def]
        users = User.objects.select_related("profile").order_by("date_joined")
        data = [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "is_staff": u.is_staff,
                "is_active": u.is_active,
                "date_joined": u.date_joined.isoformat() if u.date_joined else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
                "jlpt_level": getattr(getattr(u, "profile", None), "jlpt_level", "N5"),
            }
            for u in users
        ]
        return Response(data)

    def post(self, request):  # type: ignore[no-untyped-def]
        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip()
        password = request.data.get("password") or ""
        is_staff = bool(request.data.get("is_staff", False))

        if not username or not password:
            return Response({"detail": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username is already taken."}, status=status.HTTP_400_BAD_REQUEST)
        if email and User.objects.filter(email=email).exists():
            return Response({"detail": "Email is already in use."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=password, is_staff=is_staff)
        UserProfile.objects.get_or_create(user=user)
        audit_log(request, "user.created", target=user, extra={"is_staff": is_staff, "username": username})
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_staff": user.is_staff,
                "is_active": user.is_active,
                "date_joined": user.date_joined.isoformat() if user.date_joined else None,
                "last_login": None,
                "jlpt_level": "N5",
            },
            status=status.HTTP_201_CREATED,
        )


class UserManagementDetailView(APIView):
    """
    Update or delete a single user account (management staff only).

    PATCH  — update is_staff, is_active, or password.  A manager cannot
             modify their own account through this endpoint.
    DELETE — permanently removes the account.  Cannot self-delete.
    """

    permission_classes = [IsManagementUser]

    def patch(self, request, pk):  # type: ignore[no-untyped-def]
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response({"detail": "You cannot modify your own management status."}, status=status.HTTP_400_BAD_REQUEST)

        if "is_staff" in request.data:
            user.is_staff = bool(request.data["is_staff"])
        if "is_active" in request.data:
            user.is_active = bool(request.data["is_active"])

        new_password = request.data.get("new_password") or ""
        if new_password:
            if len(new_password) < 8:
                return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(new_password)

        user.save()
        audit_log(request, "user.updated", target=user, extra={"fields": list(request.data.keys())})
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_staff": user.is_staff,
            "is_active": user.is_active,
            "date_joined": user.date_joined.isoformat() if user.date_joined else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "jlpt_level": getattr(getattr(user, "profile", None), "jlpt_level", "N5"),
        })

    def delete(self, request, pk):  # type: ignore[no-untyped-def]
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response({"detail": "You cannot delete your own account here."}, status=status.HTTP_400_BAD_REQUEST)

        audit_log(request, "user.deleted", target=user, extra={"username": user.username})
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PlayerLevelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):  # type: ignore[no-untyped-def]
        from apps.users.level import compute_player_level
        return Response(compute_player_level(request.user))
