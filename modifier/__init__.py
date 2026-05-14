import os
import httpx
from fastapi import APIRouter
from pydantic import BaseModel
import asyncio
import numpy as np
import random
import re

router = APIRouter()

class ModifyDistributionInput(BaseModel):
    questions: list[str]
    target_distribution: dict  # {"Easy": 20, "Medium": 50, "Hard": 30} percentages

class ModifiedQuestion(BaseModel):
    original: str
    modified: str
    original_difficulty: str
    new_difficulty: str
    was_rewritten: bool = False

class ModifyDistributionResponse(BaseModel):
    total_questions: int
    rewritten_count: int
    original_distribution: dict
    target_distribution: dict
    modified_questions: list[ModifiedQuestion]

def extract_keywords(question: str) -> str:
    stopwords = {"the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or", "is", "are", "was", "were", "be", "being", "been", "have", "has", "had", "do", "does", "did", "what", "why", "how", "when", "where", "who", "which", "explain", "define", "concept", "system", "particular", "solution"}
    words = re.findall(r'\b\w+\b', question.lower())
    keywords = [w for w in words if w not in stopwords and len(w) > 2]
    return ", ".join(keywords) if keywords else "fundamental principles"

def normalize_question(question: str) -> str:
    q = question.strip()
    q = re.sub(r'^(define|explain)\s+(concept\s+)?(\w+)$', r'Explain the concept of \3 in computing systems', q, flags=re.IGNORECASE)
    if "concept" in q.lower() and len(extract_keywords(q).split(',')) <= 1:
        return "Explain a fundamental concept in computing systems."
    return q

def clean_output(output: str) -> str:
    cleaned = output.strip()
    cleaned = re.sub(r'^(define|explain) concept\b', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^design a solution for define\b', 'Design a solution for', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[(?:Hard|Medium|Easy)\]', '', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip()
    if cleaned and not cleaned[0].isupper():
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned

def is_valid_rewrite(original: str, generated: str) -> bool:
    if not generated or len(generated) < 10:
        return False
    if generated.lower().strip() == original.lower().strip():
        return False
    if original.lower().strip() in generated.lower().strip() and len(original) > 10:
        return False
    if "concept" in generated.lower() and len(extract_keywords(generated).split(",")) < 2:
        return False
    if generated.count('\n') > 1 or len(generated) > 500:
        return False
    return True

async def _call_llm(client: httpx.AsyncClient, prompt: str) -> str:
    # 1) Groq
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.8,
            "max_tokens": 300,
        }
        headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
        try:
            resp = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=15.0)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception:
            pass

    # 2) HuggingFace Serverless
    try:
        hf_payload = {"inputs": prompt, "parameters": {"max_new_tokens": 200, "temperature": 0.8}}
        hf_headers = {"Content-Type": "application/json"}
        hf_key = os.getenv("HF_API_KEY") or os.getenv("HUGGINGFACE_API_KEY")
        if hf_key:
            hf_headers["Authorization"] = f"Bearer {hf_key}"
        resp = await client.post(
            "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
            json=hf_payload, headers=hf_headers, timeout=20.0
        )
        if resp.status_code == 200:
            result = resp.json()
            if isinstance(result, list) and len(result) > 0:
                text = result[0].get("generated_text", "")
                if prompt in text:
                    text = text.split(prompt)[-1]
                text = text.strip().strip('"').strip()
                if text:
                    return text
    except Exception:
        pass

    # 3) Google Gemini
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        try:
            resp = await client.post(url, json=payload, timeout=15.0)
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception:
            pass

    # 4) OpenRouter
    api_key = os.getenv("OPENROUTER_API_KEY")
    if api_key:
        payload = {
            "model": "google/gemini-pro",
            "messages": [{"role": "user", "content": prompt}]
        }
        headers = {"Authorization": f"Bearer {api_key}"}
        try:
            resp = await client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=15.0)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception:
            pass
            
    return None

async def rewrite_question(client: httpx.AsyncClient, question: str, target_level: str) -> str:
    variety_map = {
        "Easy": ["Define", "List", "Identify"],
        "Medium": ["Explain", "Analyze", "Compare", "Illustrate"],
        "Hard": ["Design", "Evaluate", "Optimize", "Justify", "Propose"]
    }
    
    normalized_q = normalize_question(question)
    keywords = extract_keywords(normalized_q)
    
    # Retry loop
    for _ in range(3):  # up to 2 retries (total 3 attempts)
        prompt = f"""Rewrite the following question to {target_level} difficulty using Bloom's Taxonomy.

---

STRICT RULES:

1. Completely rewrite the question
   * Do NOT reuse the original sentence
   * Do NOT wrap the original question

2. Keep the SAME topic
   * Focus only on these concepts: {keywords}
   * Do NOT introduce unrelated domains

3. DO NOT use or include phrases like:
   * "design an algorithm related to"
   * "a concept"
   * "a system"
   * "related to"

4. Replace vague wording with specific technical meaning

5. Difficulty guidelines:

   Easy:
   * Simple definition or direct recall
   * Clear and concise

   Medium:
   * Explanation with reasoning or comparison
   * May include examples

   Hard:
   * Multi-step thinking
   * Must include constraints, trade-offs, or evaluation
   * Should resemble real exam problems

6. The question must:
   * Be meaningful and domain-specific
   * Be written in proper academic English
   * Be only 1 sentence (max 1-2 lines)
   * Sound like a real university exam question

7. Avoid repetition:
   * Do NOT generate common generic patterns
   * Make each question unique

---

Question:
{normalized_q}

---

Return ONLY the improved question."""

        result = await _call_llm(client, prompt)
        if result:
            result = clean_output(result)
            if is_valid_rewrite(normalized_q, result):
                return result
            
    # Fallback template (CRITICAL)
    clean_q = normalized_q.replace('?', '').strip()
    if target_level == "Medium":
        return f"Explain and analyze {clean_q} with relevant examples."
    elif target_level == "Hard":
        return f"Design an efficient solution for {clean_q.lower()} and evaluate its performance under practical constraints."
    else: # Easy
        return f"Define and list the key components of {clean_q.lower()}."

@router.post("/modify-paper-distribution", response_model=ModifyDistributionResponse)
async def modify_paper_distribution(input_data: ModifyDistributionInput):
    import main

    label_map = {0: "Easy", 1: "Medium", 2: "Hard"}

    # Classify current questions
    classified_qs = []
    for q in input_data.questions:
        features = main.extract_features(q).reshape(1, -1)
        try:
            emb = main.get_embedding(q)
            final_input = np.hstack([emb, features])
            pred = int(main.xgb_model.predict(final_input)[0])
        except Exception:
            pred = 1

        diff = label_map[pred]
        classified_qs.append({"text": q, "diff": diff})

    total = len(classified_qs)

    if total == 0:
        return ModifyDistributionResponse(
            total_questions=0, rewritten_count=0,
            original_distribution={"Easy": 0, "Medium": 0, "Hard": 0},
            target_distribution=input_data.target_distribution,
            modified_questions=[]
        )

    # Compute original distribution percentages
    orig_dist = {
        "Easy": round(sum(1 for q in classified_qs if q["diff"] == "Easy") / total * 100, 1),
        "Medium": round(sum(1 for q in classified_qs if q["diff"] == "Medium") / total * 100, 1),
        "Hard": round(sum(1 for q in classified_qs if q["diff"] == "Hard") / total * 100, 1),
    }

    target_counts = {
        "Easy": int(round(input_data.target_distribution.get("Easy", 0) / 100.0 * total)),
        "Medium": int(round(input_data.target_distribution.get("Medium", 0) / 100.0 * total)),
        "Hard": int(round(input_data.target_distribution.get("Hard", 0) / 100.0 * total))
    }

    # Adjust for rounding errors to match total exactly
    diff = total - sum(target_counts.values())
    if diff != 0:
        max_key = max(target_counts, key=target_counts.get)
        target_counts[max_key] += diff

    # Group into buckets by assigned difficulty
    buckets = {"Easy": [], "Medium": [], "Hard": []}
    for i, item in enumerate(classified_qs):
        buckets[item["diff"]].append(i)

    # Determine what needs to change
    to_rewrite = []  # list of (index, target_level)

    for level in ["Easy", "Medium", "Hard"]:
        while len(buckets[level]) > target_counts[level]:
            target_level = None
            for other in ["Easy", "Medium", "Hard"]:
                if len(buckets[other]) < target_counts[other]:
                    target_level = other
                    break

            if target_level:
                idx = buckets[level].pop()
                buckets[target_level].append(idx)
                to_rewrite.append((idx, target_level))
            else:
                break

    # Build a map: index -> (position_in_rewrite_list, target_level)
    rewrite_map = {}
    for pos, (idx, tgt) in enumerate(to_rewrite):
        rewrite_map[idx] = (pos, tgt)

    # Rewrite questions asynchronously
    rewritten_texts = []
    if to_rewrite:
        async with httpx.AsyncClient() as client:
            tasks = []
            for idx, target_level in to_rewrite:
                orig_q = classified_qs[idx]["text"]
                tasks.append(rewrite_question(client, orig_q, target_level))

            rewritten_texts = await asyncio.gather(*tasks, return_exceptions=True)

    # Reassemble Results
    results = []

    for i, item in enumerate(classified_qs):
        if i in rewrite_map:
            pos, target_level = rewrite_map[i]

            new_text_res = rewritten_texts[pos]
            if isinstance(new_text_res, Exception):
                new_text = f"[{target_level}] " + item["text"]
            else:
                new_text = new_text_res

            results.append(ModifiedQuestion(
                original=item["text"],
                modified=new_text,
                original_difficulty=item["diff"],
                new_difficulty=target_level,
                was_rewritten=True
            ))
        else:
            results.append(ModifiedQuestion(
                original=item["text"],
                modified=item["text"],
                original_difficulty=item["diff"],
                new_difficulty=item["diff"],
                was_rewritten=False
            ))

    return ModifyDistributionResponse(
        total_questions=total,
        rewritten_count=len(to_rewrite),
        original_distribution=orig_dist,
        target_distribution=input_data.target_distribution,
        modified_questions=results
    )
