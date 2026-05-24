"""
Centralised audit-event logger.

Records security-relevant actions (login, user management, imports, etc.)
to the ``apps.audit`` logger so they land in any configured log handler.

Usage::

    from apps.audit import audit_log
    audit_log(request, "user.created", target=new_user, extra={"is_staff": True})
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("apps.audit")


def audit_log(
    request,
    event: str,
    *,
    target: Any = None,
    extra: dict | None = None,
) -> None:
    """
    Emit a structured audit log entry.

    Args:
        request: The DRF/Django request providing actor identity and IP.
        event:   Dot-separated event name, e.g. ``"user.created"``.
        target:  Optional model instance that was acted upon.
        extra:   Optional dict of additional key/value pairs to log.
    """
    actor = getattr(request, "user", None)
    actor_str = f"{actor.username}(id={actor.id})" if actor and actor.is_authenticated else "anonymous"

    # Prefer X-Forwarded-For when behind a reverse proxy, fall back to REMOTE_ADDR.
    ip = (
        request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        or request.META.get("REMOTE_ADDR", "unknown")
    )

    target_str = ""
    if target is not None:
        target_str = f" target={type(target).__name__}(id={getattr(target, 'pk', '?')})"

    extra_str = ""
    if extra:
        extra_str = " " + " ".join(f"{k}={v}" for k, v in extra.items())

    logger.info("AUDIT event=%s actor=%s ip=%s%s%s", event, actor_str, ip, target_str, extra_str)
