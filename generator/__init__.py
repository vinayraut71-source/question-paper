"""
FastAPI Router — /generate-paper
---------------------------------
Generates a question paper from a pool of questions based on a
user-defined difficulty distribution (Easy / Medium / Hard percentages).

Uses the existing ML pipeline (extract_features, get_embedding, xgb_model)
to classify each question, then selects the requested number per category.
Deficit redistribution follows the priority order: Hard → Medium → Easy.
"""

import random
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["Paper Generator"])


# -------------------- INPUT SCHEMA --------------------
class GeneratePaperInput(BaseModel):
    questions: list[str] = Field(
        ..., min_length=1, description="Pool of questions to choose from"
    )
    distribution: dict = Field(
        ...,
        description='Desired difficulty split in percentages, e.g. {"easy": 40, "medium": 40, "hard": 20}',
    )
    total_questions_to_select: Optional[int] = Field(
        None,
        gt=0,
        description="Optional: pick exactly this many questions instead of using the full pool size",
    )


# -------------------- HELPERS --------------------
LABEL_MAP = {0: "Easy", 1: "Medium", 2: "Hard"}
PRIORITY_ORDER = ["Hard", "Medium", "Easy"]  # deficit-fill priority


def _validate_distribution(distribution: dict) -> dict:
    """Normalise keys to lowercase, ensure all three exist, and check total ≈ 100."""
    dist = {k.lower(): v for k, v in distribution.items()}

    for key in ("easy", "medium", "hard"):
        if key not in dist:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required distribution key: '{key}'. "
                       f"Expected keys: easy, medium, hard.",
            )
        if not isinstance(dist[key], (int, float)) or dist[key] < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Distribution value for '{key}' must be a non-negative number.",
            )

    total = dist["easy"] + dist["medium"] + dist["hard"]
    if abs(total - 100) > 5:
        raise HTTPException(
            status_code=400,
            detail=f"Distribution percentages must sum to ≈100 (got {total}).",
        )

    return dist


def _classify_questions(questions: list[str]) -> dict[str, list[str]]:
    """Classify every question using the existing ML pipeline and bucket them."""
    from main import extract_features, get_embedding, xgb_model

    buckets: dict[str, list[str]] = {"Easy": [], "Medium": [], "Hard": []}

    for q in questions:
        features = extract_features(q).reshape(1, -1)

        try:
            emb = get_embedding(q)
            final_input = np.hstack([emb, features])
            pred = int(xgb_model.predict(final_input)[0])
        except Exception:
            pred = 1  # fallback → Medium

        buckets[LABEL_MAP[pred]].append(q)

    return buckets


def _select_with_redistribution(
    buckets: dict[str, list[str]],
    required_counts: dict[str, int],
) -> list[str]:
    """
    Select questions per required counts.
    If a category has fewer than needed, redistribute the deficit
    following Hard → Medium → Easy priority.
    """
    selected: list[str] = []
    remaining = {k: list(v) for k, v in buckets.items()}  # shallow copy lists
    deficit_total = 0

    # First pass — sample what we can from each bucket
    per_category_selected: dict[str, list[str]] = {}
    for level in PRIORITY_ORDER:
        needed = required_counts.get(level, 0)
        available = remaining[level]
        if len(available) >= needed:
            chosen = random.sample(available, needed)
        else:
            chosen = list(available)
            deficit_total += needed - len(available)
        per_category_selected[level] = chosen
        # Remove chosen from remaining pool
        chosen_set = set(id(q) for q in chosen)
        remaining[level] = [q for q in available if id(q) not in chosen_set]

    # Second pass — redistribute deficit (priority: Hard → Medium → Easy)
    if deficit_total > 0:
        for donor_level in PRIORITY_ORDER:
            if deficit_total <= 0:
                break
            pool = remaining[donor_level]
            can_give = min(len(pool), deficit_total)
            if can_give > 0:
                extra = random.sample(pool, can_give)
                per_category_selected[donor_level].extend(extra)
                chosen_set = set(id(q) for q in extra)
                remaining[donor_level] = [q for q in pool if id(q) not in chosen_set]
                deficit_total -= can_give

    # Flatten
    for level_questions in per_category_selected.values():
        selected.extend(level_questions)

    return selected


# -------------------- CORE FUNCTION --------------------
def generate_question_paper(
    questions: list[str],
    distribution: dict,
    total_questions_to_select: Optional[int] = None,
) -> dict:
    """
    Analyse question difficulty using ML and select questions
    according to a teacher-defined difficulty distribution.
    """
    dist = _validate_distribution(distribution)

    # Classify
    buckets = _classify_questions(questions)

    # Determine N (how many questions to put on the paper)
    N = total_questions_to_select if total_questions_to_select else len(questions)
    N = min(N, len(questions))  # can't select more than the pool

    # Required counts per category using Largest Remainder Method
    exact_counts = {
        "Easy":   N * dist["easy"]   / 100,
        "Medium": N * dist["medium"] / 100,
        "Hard":   N * dist["hard"]   / 100,
    }
    required_counts = {k: int(v) for k, v in exact_counts.items()}
    
    diff = N - sum(required_counts.values())
    if diff > 0:
        # Sort keys by their descending decimal remainder
        remainders = {k: exact_counts[k] - required_counts[k] for k in exact_counts}
        # If there's a tie in remainder, prioritize Hard > Medium > Easy
        priority_map = {"Hard": 2, "Medium": 1, "Easy": 0}
        
        sorted_keys = sorted(
            remainders.keys(), 
            key=lambda k: (remainders[k], priority_map[k]), 
            reverse=True
        )
        
        for key in sorted_keys:
            if diff <= 0:
                break
            required_counts[key] += 1
            diff -= 1

    # Select with redistribution
    selected = _select_with_redistribution(buckets, required_counts)

    # Shuffle final output
    random.shuffle(selected)

    # Actual distribution counts
    actual_buckets = _classify_questions(selected)
    actual_distribution = {
        "Easy":   len(actual_buckets["Easy"]),
        "Medium": len(actual_buckets["Medium"]),
        "Hard":   len(actual_buckets["Hard"]),
    }

    from main import analyze_paper, PaperInput
    from compare import _compute_drift
    
    pool_analysis = analyze_paper(PaperInput(questions=questions))
    generated_analysis = analyze_paper(PaperInput(questions=selected))
    drift, interpretation = _compute_drift(pool_analysis, generated_analysis)

    return {
        "total_input_questions": len(questions),
        "total_selected": len(selected),
        "requested_distribution": {
            "Easy":   dist["easy"],
            "Medium": dist["medium"],
            "Hard":   dist["hard"],
        },
        "actual_distribution": actual_distribution,
        "selected_questions": selected,
        "metadata": {
            "available_pool": {
                "Easy":   len(buckets["Easy"]),
                "Medium": len(buckets["Medium"]),
                "Hard":   len(buckets["Hard"]),
            }
        },
        "pool_analysis": pool_analysis,
        "generated_analysis": generated_analysis,
        "drift": drift,
        "interpretation": interpretation,
    }


# -------------------- ENDPOINT --------------------
@router.post("/generate-paper")
def generate_paper(input: GeneratePaperInput):
    """
    Generate a balanced, randomized question paper from a pool of questions
    based on a desired difficulty distribution.
    """
    return generate_question_paper(
        questions=input.questions,
        distribution=input.distribution,
        total_questions_to_select=input.total_questions_to_select,
    )
