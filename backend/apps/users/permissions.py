from rest_framework import permissions


class IsManagementUser(permissions.BasePermission):
    """Allows access only to users with is_staff=True (management role)."""

    def has_permission(self, request, view):  # type: ignore[no-untyped-def]
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)
