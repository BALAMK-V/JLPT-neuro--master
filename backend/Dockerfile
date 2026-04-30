FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System packages required for OCR and PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Tesseract OCR engine
    tesseract-ocr \
    # Japanese language packs (horizontal + vertical)
    tesseract-ocr-jpn \
    tesseract-ocr-jpn-vert \
    # English language pack (used alongside Japanese)
    tesseract-ocr-eng \
    # poppler-utils: provides pdfinfo / pdftoppm used by pdf2image
    poppler-utils \
    # Shared libraries needed by Pillow
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --upgrade pip

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/

EXPOSE 8000

CMD ["sh", "-lc", "python docker/wait_for_db.py && python manage.py migrate --run-syncdb --noinput && python manage.py seed_default_users && python manage.py runserver 0.0.0.0:8000"]
