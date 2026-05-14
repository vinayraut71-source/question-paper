"""
Text Cleaning & Question Splitting Module
-------------------------------------------
Takes raw OCR text, removes noise, and splits it into
individual questions using pattern-based heuristics.
"""

import re
from typing import List


def clean_text(raw_text: str) -> str:
    """
    Clean noisy OCR output:
    - Collapse multiple whitespace / newlines into single spaces
    - Remove non-printable / control characters
    - Strip leading/trailing whitespace
    - Remove stray single characters that are OCR artefacts
    """
    # Remove non-printable characters (keep basic ASCII + common punctuation)
    text = re.sub(r"[^\x20-\x7E\n]", " ", raw_text)

    # Collapse multiple spaces / tabs into one
    text = re.sub(r"[ \t]+", " ", text)

    # Collapse multiple newlines into one
    text = re.sub(r"\n+", "\n", text)

    # Remove lines that are just a single character (OCR noise)
    lines = text.split("\n")
    lines = [line.strip() for line in lines if len(line.strip()) > 1]

    text = "\n".join(lines)
    return text.strip()


def split_into_questions(cleaned_text: str) -> List[str]:
    """
    Split cleaned text into individual questions using multiple strategies:

    1. Numbered patterns:  1. / 1) / Q1. / Q1) / (1) / i. / a.
    2. Question-mark boundaries
    3. Fallback: sentence-level splitting on newlines

    Returns a de-duplicated, non-empty list of question strings.
    """
    questions: List[str] = []

    # ---- Strategy 1: Split on numbered question patterns ----
    # Matches patterns like:
    #   "1." "1)" "(1)" "Q1." "Q.1" "Q 1." "q1)" etc.
    numbered_pattern = re.compile(
        r"(?:^|\n)\s*"                          # start of line
        r"(?:"
        r"(?:Q|q)[\s.]*\d+[.)]\s*"              # Q1. Q1) Q.1)
        r"|\(\d+\)\s*"                           # (1)
        r"|\d+\s*[.)]\s*"                        # 1. 1)
        r"|[ivxIVX]+\s*[.)]\s*"                  # i. ii) IV.
        r"|[a-hA-H]\s*[.)]\s*"                   # a. b) c.
        r")"
    )

    parts = numbered_pattern.split(cleaned_text)
    # Filter out empty splits
    numbered_questions = [p.strip() for p in parts if p and p.strip()]

    if len(numbered_questions) >= 2:
        # Numbered splitting worked well
        questions = numbered_questions
    else:
        # ---- Strategy 2: Split on question marks ----
        qmark_parts = re.split(r"\?", cleaned_text)
        qmark_questions = []
        for part in qmark_parts:
            part = part.strip()
            if part:
                qmark_questions.append(part + "?")

        if len(qmark_questions) >= 2:
            # Remove trailing ? from last fragment if it wasn't really a question
            if qmark_questions and not cleaned_text.rstrip().endswith("?"):
                last = qmark_questions[-1]
                qmark_questions[-1] = last.rstrip("?").strip()
                if not qmark_questions[-1]:
                    qmark_questions.pop()
            questions = qmark_questions
        else:
            # ---- Strategy 3: Fallback — split on newlines ----
            questions = [
                line.strip() for line in cleaned_text.split("\n")
                if len(line.strip()) > 10  # skip very short noise lines
            ]

    # ---- Post-processing ----
    # Remove leading numbering artefacts that may remain
    cleaned_questions: List[str] = []
    for q in questions:
        # Strip leftover numbering like "1." or "Q2)" at the start
        q = re.sub(r"^\s*(?:(?:Q|q)[\s.]*\d+[.)]\s*|\(\d+\)\s*|\d+\s*[.)]\s*|[ivxIVX]+\s*[.)]\s*|[a-hA-H]\s*[.)]\s*)", "", q)
        q = q.strip()
        if q and len(q) > 5:   # skip trivially short fragments
            cleaned_questions.append(q)

    # De-duplicate while preserving order
    seen = set()
    unique_questions: List[str] = []
    for q in cleaned_questions:
        key = q.lower().strip()
        if key not in seen:
            seen.add(key)
            unique_questions.append(q)

    return unique_questions
