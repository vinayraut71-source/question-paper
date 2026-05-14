import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import joblib
import torch
import numpy as np
from transformers import DistilBertTokenizerFast, DistilBertModel

# Routers
from ocr.router import router as ocr_router
from compare import router as compare_router
from generator import router as generator_router
from modifier import router as modifier_router
from export import router as export_router

# -------------------- APP --------------------
app = FastAPI(title="AI Question Difficulty & Cognitive Analyzer")

# -------------------- CORS --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- ROUTERS --------------------
app.include_router(ocr_router, prefix="/api")
app.include_router(compare_router, prefix="/api")
app.include_router(generator_router, prefix="/api")
app.include_router(modifier_router, prefix="/api")
app.include_router(export_router, prefix="/api")

# -------------------- STATIC FRONTEND --------------------
app.mount("/static", StaticFiles(directory="static"), name="static")

# -------------------- GLOBALS --------------------
xgb_model = None
tokenizer = None
bert_model = None
device = torch.device("cpu")

# -------------------- FEATURE EXTRACTOR --------------------
def extract_features(question_text: str):
    q = question_text.lower()

    question_length = len(q.split())

    num_equations = 1 if any(x in q for x in ["=", "^", "log", "/", "sin", "cos"]) else 0

    code_keywords = [
        "array", "loop", "recursion", "graph", "tree",
        "stack", "queue", "dp", "hashmap", "heap"
    ]
    num_code_keywords = sum(1 for w in code_keywords if w in q)

    # -------------------- ADVANCED BLOOM --------------------
    bloom_dict = {
        1: ["define", "list", "identify", "recall", "name"],
        2: ["explain", "describe", "summarize", "classify", "illustrate"],
        3: ["apply", "implement", "solve", "use", "calculate", "execute"],
        4: ["analyze", "differentiate", "compare", "contrast", "derive", "examine"],
        5: ["evaluate", "justify", "critique", "argue", "prove", "assess"],
        6: ["design", "develop", "create", "construct", "formulate", "build"]
    }

    bloom_hits = []

    for level, words in bloom_dict.items():
        for w in words:
            count = q.count(w)
            if count > 0:
                bloom_hits.extend([level] * count)

    # Phrase boosts
    if "how would you" in q or "in what way" in q:
        bloom_hits.append(4)

    if "design and implement" in q:
        bloom_hits.append(6)

    if "analyze and justify" in q:
        bloom_hits.append(5)

    # Final Bloom level
    if bloom_hits:
        base_level = sum(bloom_hits) / len(bloom_hits)
        bloom_level = min(6, round(base_level + (max(bloom_hits) * 0.25)))
    else:
        bloom_level = 1

    # Keep simple questions simple
    if question_length <= 3 and bloom_level == 1:
        bloom_level = 1

    # Derived features
    num_steps_expected = bloom_level + 1
    conceptual_level = min(5, bloom_level)

    return np.array([
        question_length,
        num_equations,
        num_code_keywords,
        num_steps_expected,
        conceptual_level,
        bloom_level * 8,
        bloom_level * 2
    ])

# -------------------- BERT EMBEDDING --------------------
def get_embedding(text: str):
    enc = tokenizer(text, return_tensors="pt", truncation=True, padding=True).to(device)
    with torch.no_grad():
        output = bert_model(**enc)
    return output.last_hidden_state[:, 0, :].cpu().numpy()

# -------------------- STARTUP EVENT --------------------
@app.on_event("startup")
def load_models():
    global xgb_model, tokenizer, bert_model

    xgb_model = joblib.load("hybrid_xgboost_model.pkl")
    tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")
    bert_model = DistilBertModel.from_pretrained("distilbert-base-uncased")

    bert_model.eval()
    bert_model.to(device)

    # Warm-up
    _ = get_embedding("test question")
    _ = extract_features("test question")

# -------------------- SCHEMA --------------------
class QuestionInput(BaseModel):
    question: str

class PaperInput(BaseModel):
    questions: list[str]

# -------------------- SINGLE PREDICTION --------------------
@app.post("/predict")
def predict_difficulty(input: QuestionInput):
    features = extract_features(input.question).reshape(1, -1)
    bloom_level = int(features[0][-1] / 2)

    try:
        emb = get_embedding(input.question)
        final_input = np.hstack([emb, features])
        pred = int(xgb_model.predict(final_input)[0])
    except Exception:
        pred = 1  # fallback → Medium

    label_map = {0: "Easy", 1: "Medium", 2: "Hard"}

    return {
        "question": input.question,
        "difficulty": label_map[pred],
        "bloom_level": bloom_level
    }

# -------------------- PAPER ANALYSIS --------------------
@app.post("/analyze-paper")
def analyze_paper(input: PaperInput):

    label_map = {0: "Easy", 1: "Medium", 2: "Hard"}

    results = []
    bloom_levels = []

    for q in input.questions:
        features = extract_features(q).reshape(1, -1)
        bloom = int(features[0][-1] / 2)

        try:
            emb = get_embedding(q)
            final_input = np.hstack([emb, features])
            pred = int(xgb_model.predict(final_input)[0])
        except Exception:
            pred = 1  # fallback

        difficulty = label_map[pred]

        results.append(difficulty)
        bloom_levels.append(bloom)

    total = len(results)

    if total == 0:
        return {
            "total_questions": 0,
            "difficulty_distribution": {"Easy": 0, "Medium": 0, "Hard": 0},
            "average_bloom_level": 0,
            "complexity_score": 0
        }

    dist = {
        "Easy": round(results.count("Easy") / total * 100, 2),
        "Medium": round(results.count("Medium") / total * 100, 2),
        "Hard": round(results.count("Hard") / total * 100, 2),
    }

    avg_bloom = round(sum(bloom_levels) / total, 2)

    complexity_score = round(
        (dist["Hard"] * 0.6 + dist["Medium"] * 0.3 + avg_bloom * 2.5),
        2
    )

    return {
        "total_questions": total,
        "difficulty_distribution": dist,
        "average_bloom_level": avg_bloom,
        "complexity_score": complexity_score
    }

# -------------------- FRONTEND --------------------
@app.get("/")
def serve_frontend():
    if os.path.exists("static/index.html"):
        resp = FileResponse("static/index.html")
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp
    return JSONResponse({"message": "API is running 🚀"})

# -------------------- HEALTH --------------------
@app.get("/health")
def health():
    return {"status": "Backend is running 🚀"}