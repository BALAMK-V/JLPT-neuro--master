import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jlpt_neuro_master.settings")

app = Celery("jlpt_neuro_master")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
