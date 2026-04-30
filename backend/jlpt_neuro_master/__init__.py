__version__ = '0.2.0'

try:
    from .celery import app as celery_app  # noqa: F401 — load Celery app with Django startup
    __all__ = ("celery_app",)
except ImportError:
    pass  # celery not installed yet; OCR will fall back to threading

