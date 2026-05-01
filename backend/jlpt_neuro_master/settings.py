from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(name: str, default: str | None = None) -> str | None:
    return os.getenv(name, default)


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-change-me")  # nosec - dev default
DEBUG = env("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = [h.strip() for h in (env("DJANGO_ALLOWED_HOSTS", "") or "").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "django_filters",
    "rest_framework",
    "rest_framework_simplejwt",
    "storages",
    "channels",
    "apps.users.apps.UsersConfig",
    "apps.content.apps.ContentConfig",
    "apps.listening.apps.ListeningConfig",
    "apps.reading.apps.ReadingConfig",
    "apps.grammar.apps.GrammarConfig",
    "apps.flashcards.apps.FlashcardsConfig",
    "apps.assessment.apps.AssessmentConfig",
    "apps.notes.apps.NotesConfig",
    "apps.neuro.apps.NeuroConfig",
    "apps.tracking.apps.TrackingConfig",
    "apps.jlpt_exam.apps.JlptExamConfig",
    "apps.ocr.apps.OcrConfig",
    "apps.quiz_room",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "jlpt_neuro_master.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "jlpt_neuro_master.wsgi.application"
ASGI_APPLICATION = "jlpt_neuro_master.asgi.application"


DATABASE_URL = env("DATABASE_URL")
if DATABASE_URL:
    from urllib.parse import urlparse

    parsed = urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": (parsed.path or "").lstrip("/"),
            "USER": parsed.username,
            "PASSWORD": parsed.password,
            "HOST": parsed.hostname,
            "PORT": parsed.port or 5432,
        }
    }
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [o.strip() for o in (env("CORS_ALLOWED_ORIGINS", "") or "").split(",") if o.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in (env("CSRF_TRUSTED_ORIGINS", "") or "").split(",") if o.strip()]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=2),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", "") or ""
ANTHROPIC_MODEL = env("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001") or "claude-haiku-4-5-20251001"

# Celery — set CELERY_BROKER_URL in .env to activate (e.g. redis://localhost:6379/0)
CELERY_BROKER_URL = env("CELERY_BROKER_URL", "redis://localhost:6379/0") or "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", "redis://localhost:6379/0") or "redis://localhost:6379/0"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# Django Channels — WebSocket support for multiplayer quiz
# Uses Redis channel layer when REDIS_URL is set; falls back to in-memory (single process only)
_REDIS_URL = env("REDIS_URL", "") or env("CELERY_BROKER_URL", "") or ""
if _REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [_REDIS_URL]},
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

USE_S3 = env("USE_S3", "0") == "1"
if USE_S3:
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME") or ""
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME") or ""
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID") or ""
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY") or ""
    AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN") or ""
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    AWS_QUERYSTRING_AUTH = False
    AWS_DEFAULT_ACL = None
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"


