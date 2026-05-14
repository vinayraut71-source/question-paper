"""
OCR Text Extraction Module
---------------------------
Handles extracting raw text from uploaded PDF and image files
using EasyOCR (GPU-optional) with pdf2image for PDF page rendering.

Also provides post-OCR text cleaning and question splitting so that
a single call to `extract_questions()` returns a ready-to-analyze list.
"""

import io
import re
import tempfile
import os
from pathlib import Path
from typing import List

import easyocr
from PIL import Image

# Lazy-initialised EasyOCR reader (heavy model load — singleton)
_reader: easyocr.Reader | None = None

# Minimum character length for a fragment to be considered a real question
_MIN_QUESTION_LENGTH = 10


# ======================================================================
#  EXISTING OCR FUNCTIONS (unchanged)
# ======================================================================

def _get_reader() -> easyocr.Reader:
    """Return a cached EasyOCR reader instance."""
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(["en"], gpu=False)
    return _reader


def extract_text_from_image(image: Image.Image) -> str:
    """Run OCR on a single PIL Image and return raw text."""
    reader = _get_reader()
    # EasyOCR accepts numpy arrays or file paths
    import numpy as np
    img_array = np.array(image.convert("RGB"))
    results = reader.readtext(img_array, detail=0)  # detail=0 → list of strings
    return " ".join(results)


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Convert each page of a PDF to an image, then OCR every page."""
    from pdf2image import convert_from_bytes

    # Explicit poppler_path is used to ensure compatibility on Windows systems
    images: List[Image.Image] = convert_from_bytes(
        pdf_bytes,
        dpi=300,
        poppler_path=r"C:\poppler-25.12.0\Library\bin"
    )
    page_texts: List[str] = []
    for page_img in images:
        page_texts.append(extract_text_from_image(page_img))
    return "\n".join(page_texts)


def extract_text(file_bytes: bytes, filename: str) -> str:
    """
    Dispatch to the right extractor based on file extension.

    Supported: .pdf, .jpg, .jpeg, .png
    Returns the raw OCR text.
    """
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        return extract_text_from_pdf_bytes(file_bytes)
    elif ext in {".jpg", ".jpeg", ".png"}:
        image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        return extract_text_from_image(image)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Accepted: .pdf, .jpg, .jpeg, .png")


# ======================================================================
#  TEXT CLEANING — fix common OCR noise
# ======================================================================

def clean_ocr_text(raw_text: str) -> str:
    """
    Clean noisy OCR output and normalize it for downstream splitting.

    Steps:
      1. Strip non-printable / control characters (keep basic ASCII)
      2. Fix OCR punctuation spacing  (" ?" → "?", " ." → ".", " ," → ",")
      3. Collapse multiple whitespace / newlines into single space / newline
      4. Remove single-character noise lines
      5. Normalize Unicode whitespace and strip edges
    """
    text = raw_text

    # 1. Remove non-printable characters, keep printable ASCII + newlines
    text = re.sub(r"[^\x20-\x7E\n]", " ", text)

    # 2. Fix OCR punctuation spacing artefacts
    #    e.g. "What is deadlock ?" → "What is deadlock?"
    text = re.sub(r"\s+\?", "?", text)
    text = re.sub(r"\s+\.", ".", text)
    text = re.sub(r"\s+,", ",", text)
    text = re.sub(r"\s+;", ";", text)
    text = re.sub(r"\s+:", ":", text)
    text = re.sub(r"\s+!", "!", text)

    # 3. Collapse multiple spaces / tabs into one; multiple newlines into one
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", "\n", text)

    # 4. Remove lines that are very short (single-char OCR noise)
    lines = text.split("\n")
    lines = [line.strip() for line in lines if len(line.strip()) > 1]
    text = "\n".join(lines)

    # 5. Final trim
    return text.strip()


# ======================================================================
#  QUESTION SPLITTING — turn cleaned text into a list of questions
# ======================================================================

def split_questions(cleaned_text: str) -> List[str]:
    """
    Split cleaned OCR text into individual questions.
    Handles inline numbering and provides a fallback keyword-based split.
    """
    # 1. Split using inline numbering patterns like "1. " or "1) "
    raw_parts = re.split(r"(?:\d+\.\s+|\d+\)\s+)", cleaned_text)
    
    questions: List[str] = []
    for part in raw_parts:
        q = part.strip()
        # Filter very short fragments (< 8 characters)
        if len(q) >= 8:
            questions.append(q)

    # 2. Add fallback: If only 1 question is detected, try splitting by keywords
    if len(questions) <= 1:
        keyword_pattern = r"(?i)(?=\b(?:Define|Explain|List|Design|Analyze)\b)"
        fallback_parts = re.split(keyword_pattern, cleaned_text)
        
        fallback_qs = []
        for part in fallback_parts:
            q = part.strip()
            if len(q) >= 8:
                fallback_qs.append(q)
                
        if len(fallback_qs) > 1:
            questions = fallback_qs
        else:
            if len(cleaned_text.strip()) >= 8:
                 questions = [cleaned_text.strip()]
                 
    # 3. De-duplicate while preserving order
    final: List[str] = []
    seen = set()
    for q in questions:
        key = q.lower()
        if key not in seen:
            seen.add(key)
            final.append(q)

    return final

    return final


# ======================================================================
#  MAIN ENTRY POINT — full pipeline: OCR → clean → split
# ======================================================================

def extract_questions(file_bytes: bytes, filename: str) -> List[str]:
    """
    End-to-end extraction of structured questions from a file.

    1. Detect file type (PDF or image) from *filename* extension.
    2. Run OCR via the existing `extract_text` function.
    3. Clean the raw text with `clean_ocr_text`.
    4. Split into individual questions with `split_questions`.
    5. Return a list of clean question strings.

    Parameters
    ----------
    file_bytes : bytes
        Raw file content (PDF or image).
    filename : str
        Original filename — used to determine the file type.

    Returns
    -------
    List[str]
        Cleaned, structured list of questions extracted from the file.

    Example
    -------
    >>> questions = extract_questions(pdf_bytes, "paper.pdf")
    >>> questions
    ['Define deadlock', 'Explain paging in operating systems', ...]
    """
    # Step 1 + 2: Extract raw OCR text (file-type detection is inside extract_text)
    raw_text: str = extract_text(file_bytes, filename)

    # Step 3: Clean OCR artefacts
    cleaned_text: str = clean_ocr_text(raw_text)

    # Step 4: Split into individual questions
    questions: List[str] = split_questions(cleaned_text)

    return questions
