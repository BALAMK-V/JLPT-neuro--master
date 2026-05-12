"""JWT WebSocket authentication middleware for Django Channels."""
from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _get_user_from_token(token_str: str):  # type: ignore[no-untyped-def]
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import AccessToken
    from rest_framework_simplejwt.exceptions import TokenError

    User = get_user_model()
    try:
        token = AccessToken(token_str)
        return User.objects.get(id=token["user_id"])
    except (TokenError, User.DoesNotExist, Exception):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Read ?token=<jwt> from WebSocket query string and authenticate."""

    async def __call__(self, scope, receive, send):  # type: ignore[no-untyped-def]
        qs = parse_qs(scope.get("query_string", b"").decode())
        token_list = qs.get("token", [])
        if token_list:
            scope["user"] = await _get_user_from_token(token_list[0])
        else:
            scope["user"] = AnonymousUser()
        return await super().__call__(scope, receive, send)
