"""
OCR processing pipeline for JLPT question papers.

Supports:
  - Image files: JPG, JPEG, PNG, BMP, TIFF, WEBP
  - PDF files: converted to images via pdf2image (requires poppler)

OCR engines (in priority order):
  1. pytesseract + Tesseract with jpn language pack  (free, local)
  2. Google Cloud Vision API                          (optional, higher accuracy)

Both engines degrade gracefully when not installed / configured.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _tesseract_available() -> bool:
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
        return True
    except ImportError:
        return False


def _pdf2image_available() -> bool:
    try:
        from pdf2image import convert_from_path  # noqa: F401
        return True
    except ImportError:
        return False


def _google_vision_available() -> bool:
    try:
        from google.cloud import vision  # noqa: F401
        return bool(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    except ImportError:
        return False


def _ocr_image_tesseract(image) -> str:
    import pytesseract
    # Use both vertical and horizontal Japanese models
    config = "--psm 6 -c preserve_interword_spaces=1"
    return pytesseract.image_to_string(image, lang="jpn+jpn_vert+eng", config=config)


def _ocr_image_google_vision(image_bytes: bytes) -> str:
    from google.cloud import vision

    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    response = client.document_text_detection(image=image)
    if response.error.message:
        raise RuntimeError(f"Google Vision error: {response.error.message}")
    return response.full_text_annotation.text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def extract_text_from_image(image_path: str | Path) -> str:
    """Extract Japanese text from a single image file."""
    path = Path(image_path)

    if _google_vision_available():
        logger.info("Using Google Vision API for %s", path.name)
        image_bytes = path.read_bytes()
        return _ocr_image_google_vision(image_bytes)

    if _tesseract_available():
        logger.info("Using Tesseract OCR for %s", path.name)
        from PIL import Image
        img = Image.open(path)
        return _ocr_image_tesseract(img)

    raise RuntimeError(
        "No OCR engine available. Install pytesseract + Tesseract, "
        "or configure Google Cloud Vision credentials."
    )


def extract_text_from_pdf(pdf_path: str | Path) -> str:
    """Convert a PDF to page images then OCR each page."""
    if not _pdf2image_available():
        raise RuntimeError(
            "pdf2image is not installed. Run: pip install pdf2image\n"
            "Also install poppler: https://poppler.freedesktop.org/"
        )

    from pdf2image import convert_from_path

    logger.info("Converting PDF to images: %s", pdf_path)
    # 150 DPI is sufficient for Tesseract OCR and ~4x faster than 300 DPI
    pages = convert_from_path(str(pdf_path), dpi=150)

    all_text: list[str] = []
    for i, page_img in enumerate(pages, start=1):
        logger.info("OCR page %d / %d", i, len(pages))

        if _google_vision_available():
            import io
            buf = io.BytesIO()
            page_img.save(buf, format="PNG")
            page_text = _ocr_image_google_vision(buf.getvalue())
        elif _tesseract_available():
            page_text = _ocr_image_tesseract(page_img)
        else:
            raise RuntimeError("No OCR engine available.")

        all_text.append(f"=== PAGE {i} ===\n{page_text}")

    return "\n\n".join(all_text)


def process_paper(file_path: str | Path) -> str:
    """
    Main entry point.  Detect file type, run OCR, and return extracted text.
    Raises ValueError for unsupported file types.
    Raises RuntimeError when no OCR engine is available.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return extract_text_from_pdf(path)
    if suffix in IMAGE_EXTENSIONS:
        return extract_text_from_image(path)

    raise ValueError(
        f"Unsupported file type '{suffix}'. "
        f"Supported: PDF, {', '.join(sorted(IMAGE_EXTENSIONS))}"
    )
