"""
FastAPI Router — /compare-papers & /compare-papers-upload
-----------------------------------------------------------
Accepts two lists of questions (JSON) or two uploaded files (OCR),
runs the existing analysis pipeline on each, and computes drift.
Includes human-readable interpretation of all drift metrics.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel, Field
from typing import List

router = APIRouter(tags=["Drift Detection"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_MB = 20


class ComparePapersInput(BaseModel):
    paper1: List[str] = Field(..., min_length=1, description="Questions from paper 1")
    paper2: List[str] = Field(..., min_length=1, description="Questions from paper 2")


def interpret_shift(value: float) -> str:
    """
    Interpret a numeric drift value into a human-readable trend label.

    Rules:
        >  5    → "Significant Increase"
        0 to 5  → "Slight Increase"
        < -5    → "Significant Decrease"
        -5 to 0 → "Slight Decrease"
        == 0    → "No Change"
    """
    if value > 5:
        return "Significant Increase"
    elif 0 < value <= 5:
        return "Slight Increase"
    elif value < -5:
        return "Significant Decrease"
    elif -5 <= value < 0:
        return "Slight Decrease"
    else:
        return "No Change"


def _compute_drift(analysis1: dict, analysis2: dict) -> dict:
    """Compute drift metrics and human-readable interpretation."""
    dist1 = analysis1["difficulty_distribution"]
    dist2 = analysis2["difficulty_distribution"]

    difficulty_shift = {
        "Easy":   round(dist2["Easy"]   - dist1["Easy"],   2),
        "Medium": round(dist2["Medium"] - dist1["Medium"], 2),
        "Hard":   round(dist2["Hard"]   - dist1["Hard"],   2),
    }

    bloom_shift = round(
        analysis2["average_bloom_level"] - analysis1["average_bloom_level"], 2
    )

    complexity_change = round(
        analysis2["complexity_score"] - analysis1["complexity_score"], 2
    )

    drift = {
        "difficulty_shift":  difficulty_shift,
        "bloom_shift":       bloom_shift,
        "complexity_change": complexity_change,
    }

    interpretation = {
        "difficulty_trend": {
            "Easy":   interpret_shift(difficulty_shift["Easy"]),
            "Medium": interpret_shift(difficulty_shift["Medium"]),
            "Hard":   interpret_shift(difficulty_shift["Hard"]),
        },
        "bloom_trend":      interpret_shift(bloom_shift),
        "complexity_trend": interpret_shift(complexity_change),
    }

    return drift, interpretation


def _validate_file(file: UploadFile, label: str) -> str:
    """Validate file extension. Returns the extension."""
    filename = file.filename or "unknown"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"{label}: Unsupported file type '{ext}'. Accepted: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    return ext


async def _extract_questions_from_file(file: UploadFile, label: str) -> List[str]:
    """Read file, run OCR, clean, and split into questions."""
    from ocr.extractor import extract_text
    from ocr.cleaner import clean_text, split_into_questions

    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail=f"{label}: Uploaded file is empty.")

    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"{label}: File too large. Maximum allowed size is {MAX_FILE_SIZE_MB} MB."
        )

    try:
        raw_text = extract_text(file_bytes, file.filename or "file.png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{label}: OCR extraction failed: {str(e)}")

    cleaned = clean_text(raw_text)
    questions = split_into_questions(cleaned)

    if not questions:
        raise HTTPException(
            status_code=422,
            detail=f"{label}: No questions could be extracted from the uploaded file."
        )

    return questions


# -------------------- JSON ENDPOINT --------------------
@router.post("/compare-papers")
def compare_papers(input: ComparePapersInput):
    """
    Compare two question papers (provided as JSON question lists)
    by analyzing each with the existing ML pipeline and computing drift.
    Returns analysis, drift metrics, and human-readable interpretation.
    """
    from main import analyze_paper, PaperInput

    analysis1 = analyze_paper(PaperInput(questions=input.paper1))
    analysis2 = analyze_paper(PaperInput(questions=input.paper2))

    drift, interpretation = _compute_drift(analysis1, analysis2)

    return {
        "paper1_analysis":  analysis1,
        "paper2_analysis":  analysis2,
        "drift":            drift,
        "interpretation":   interpretation,
    }


# -------------------- FILE UPLOAD ENDPOINT --------------------
@router.post("/compare-papers-upload")
async def compare_papers_upload(
    paper1: UploadFile = File(..., description="Paper 1 — PDF or image"),
    paper2: UploadFile = File(..., description="Paper 2 — PDF or image"),
):
    """
    Upload two question papers (PDF or image) and compare them.
    Both files go through OCR → cleaning → question splitting → analysis → drift.
    Returns analysis, drift metrics, and human-readable interpretation.
    """
    from main import analyze_paper, PaperInput

    # Validate both files upfront
    _validate_file(paper1, "Paper 1")
    _validate_file(paper2, "Paper 2")

    # Extract questions from both files
    questions1 = await _extract_questions_from_file(paper1, "Paper 1")
    questions2 = await _extract_questions_from_file(paper2, "Paper 2")

    # Analyze both
    analysis1 = analyze_paper(PaperInput(questions=questions1))
    analysis2 = analyze_paper(PaperInput(questions=questions2))

    drift, interpretation = _compute_drift(analysis1, analysis2)

    return {
        "paper1_filename":  paper1.filename,
        "paper2_filename":  paper2.filename,
        "paper1_questions": questions1,
        "paper2_questions": questions2,
        "paper1_analysis":  analysis1,
        "paper2_analysis":  analysis2,
        "drift":            drift,
        "interpretation":   interpretation,
    }
