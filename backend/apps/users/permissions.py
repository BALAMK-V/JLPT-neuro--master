"""
Custom DRF permission classes for role-based access control.

The app uses Django's built-in ``is_staff`` flag as the single axis of
privilege:

* Regular users   — ``is_staff=False`` — access all learning features.
* Management users — ``is_staff=True``  — additionally access imports,
  paper upload, and user-management endpoints.
"""
from __future__ import annotations

from rest_framework import permissions


class IsManagementUser(permissions.BasePermission):
    """
    Grant access only to authenticated staff (management) users.

    Checked on every request via DRF's permission layer; the frontend
    also hides management-only routes, but backend enforcement is the
    authoritative gate.
    """

    message = "Management access required."

    def has_permission(self, request, view) -> bool:  # type: ignore[override]
        """Return True only when the caller is an authenticated staff member."""
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


class IsOwnerOrManagement(permissions.BasePermission):
    """
    Object-level permission: allow access to the object's owner or any
    management user.

    Views must call ``self.check_object_permissions(request, obj)`` and the
    model object must expose a ``user`` attribute that refers to its owner.
    """

    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        """Return True when the caller owns the object or is staff."""
        if request.user and request.user.is_staff:
            return True
        return getattr(obj, "user", None) == request.user
