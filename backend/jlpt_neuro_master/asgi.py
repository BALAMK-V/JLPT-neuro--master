import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jlpt_neuro_master.settings")

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.quiz_room.jwt_auth import JWTAuthMiddleware  # noqa: E402
from apps.quiz_room.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
