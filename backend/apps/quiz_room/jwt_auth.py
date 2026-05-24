"""
JWT WebSocket authentication middleware for Django Channels.

Reads the ``?token=<access-jwt>`` query-string parameter that the frontend
appends to every WebSocket URL and resolves it to a Django user, which is
then stored in ``scope["user"]``.

Security note
-------------
The token travels in the WebSocket URL query-string.  On plain ``ws://``
connections (local dev) it is visible in clear-text.  In production the
app *must* be served over ``wss://`` (TLS), which encrypts the URL and its
query parameters in transit.  Server-side access logs should be configured
to omit query strings (e.g. ``$uri`` instead of ``$request_uri`` in nginx)
to prevent tokens from being persisted in log files.
"""
from __future__ import annotations

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


@database_sync_to_async
def _get_user_from_token(token_str: str):  # type: ignore[no-untyped-def]
    """
    Validate a JWT access token string and return the owning Django user.

    Args:
        token_str: Raw JWT string (three base64url segments separated by dots).

    Returns:
        The ``User`` instance on success, or ``AnonymousUser`` when the token
        is missing, malformed, expired, or refers to a non-existent account.
    """
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import AccessToken

    User = get_user_model()
    try:
        token = AccessToken(token_str)
        user = User.objects.get(id=token["user_id"])
        logger.debug("WS auth: resolved user id=%s", user.id)
        return user
    except TokenError as exc:
        logger.warning("WS auth: invalid token — %s", exc)
        return AnonymousUser()
    except User.DoesNotExist:
        logger.warning("WS auth: token user_id not found")
        return AnonymousUser()
    except Exception as exc:  # pragma: no cover
        logger.error("WS auth: unexpected error — %s", exc)
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    ASGI middleware that authenticates WebSocket connections via JWT.

    Extracts the ``token`` query-string parameter, validates it, and
    populates ``scope["user"]`` before the request reaches any consumer.
    Unauthenticated connections receive ``AnonymousUser``; the consumer
    decides whether to accept or reject them.
    """

    async def __call__(self, scope, receive, send):  # type: ignore[no-untyped-def]
        """Process the incoming connection scope and inject the resolved user."""
        qs = parse_qs(scope.get("query_string", b"").decode())
        token_list = qs.get("token", [])
        if token_list:
            scope["user"] = await _get_user_from_token(token_list[0])
        else:
            scope["user"] = AnonymousUser()
            logger.debug("WS auth: no token provided, proceeding as anonymous")
        return await super().__call__(scope, receive, send)
