"""
FastAPI Router — /upload-paper
-------------------------------
Accepts PDF or image uploads, runs the unified OCR → clean → split
pipeline via `extract_questions`, then automatically feeds the
extracted questions into the AI analysis pipeline.

No ML logic lives here — analysis is delegated to main.analyze_paper.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List

from .extractor import extract_questions          # unified OCR pipeline

router = APIRouter(tags=["OCR & Question Extraction"])

# ── Validation constants ──────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_MB = 20
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


# ── Helper ────────────────────────────────────────────────────────────
def _validate_upload(filename: str, file_bytes: bytes) -> str:
    """
    Validate the uploaded file's extension and size.

    Returns the normalised file extension on success;
    raises HTTPException on any validation failure.
    """
    # Extract extension
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE_MB} MB.",
        )

    return ext


# ── Endpoint ──────────────────────────────────────────────────────────
@router.post("/upload-paper")
async def upload_paper(file: UploadFile = File(...)):
    """
    Upload a question paper (PDF or image), extract questions via OCR,
    and automatically analyze them for difficulty distribution.

    **Accepted formats:** PDF, JPG, JPEG, PNG
    **Max file size:** 20 MB

    **Response:**
    ```json
    {
      "filename": "paper.pdf",
      "total_questions": 5,
      "questions": ["question1", "question2", ...],
      "analysis": {
        "difficulty_distribution": {"Easy": 40.0, "Medium": 40.0, "Hard": 20.0},
        "average_bloom_level": 3.2,
        "complexity_score": 25.5
      }
    }
    ```
    """
    filename: str = file.filename or "unknown"

    # ── 1. Read & validate ────────────────────────────────────────────
    file_bytes: bytes = await file.read()
    _validate_upload(filename, file_bytes)

    # ── 2. OCR → Clean → Split (single call) ─────────────────────────
    try:
        questions: List[str] = extract_questions(file_bytes, filename)
    except ValueError as e:
        # extract_questions raises ValueError for unsupported extensions
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR extraction failed: {str(e)}",
        )

    # No questions found — return early with null analysis
    if not questions:
        return {
            "filename": filename,
            "total_questions": 0,
            "questions": [],
            "analysis": None,
        }

    # ── 3. Run AI analysis pipeline ───────────────────────────────────
    # Lazy import avoids circular dependency (main.py imports this router)
    from main import analyze_paper, PaperInput

    try:
        paper_input = PaperInput(questions=questions)
        analysis = analyze_paper(paper_input)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis pipeline failed: {str(e)}",
        )

    # ── 4. Build structured response ─────────────────────────────────
    return {
        "filename": filename,
        "total_questions": len(questions),
        "questions": questions,
        "analysis": {
            "difficulty_distribution": analysis["difficulty_distribution"],
            "average_bloom_level": analysis["average_bloom_level"],
            "complexity_score": analysis["complexity_score"],
        },
    }
