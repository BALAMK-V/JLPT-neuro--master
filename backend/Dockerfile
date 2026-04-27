FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/

EXPOSE 8000

CMD ["sh", "-lc", "python docker/wait_for_db.py && python manage.py migrate --run-syncdb --noinput && python manage.py seed_default_users && python manage.py runserver 0.0.0.0:8000"]

