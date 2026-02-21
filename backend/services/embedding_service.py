"""
Embedding Service — Generates text embeddings for semantic gravity.

Uses a lightweight approach: Claude extracts semantic features from text,
then we hash those features into a fixed-dimension vector.
This avoids needing a separate embedding model while still capturing meaning.
"""

import hashlib
import json
import numpy as np
import anthropic


EMBEDDING_DIM = 256


async def generate_embedding(text: str) -> list[float]:
    """
    Generate a semantic embedding vector for the given text.

    Strategy: Use Claude to extract structured semantic features,
    then convert those features into a stable numeric vector.
    This gives us meaningful similarity without a dedicated embedding model.
    """
    client = anthropic.AsyncAnthropic()

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system="""Extract semantic features from the given text. Return a JSON object with these exact fields:
{
  "category": "one word category (apartment, restaurant, cafe, activity, travel, shopping, note, other)",
  "location_keywords": ["list", "of", "location", "words"],
  "attribute_keywords": ["list", "of", "descriptive", "attributes"],
  "price_level": 0-5 (0=not applicable, 1=budget, 5=luxury),
  "quality_signal": 0-5 (0=not applicable, 1=poor, 5=excellent),
  "mood": "one word mood (cozy, energetic, quiet, busy, romantic, casual, professional, fun)",
  "purpose": "one word purpose (living, dining, entertainment, work, exercise, shopping, learning)"
}
Respond ONLY with the JSON object.""",
        messages=[{"role": "user", "content": text}]
    )

    response_text = response.content[0].text
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0]
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0]

    features = json.loads(response_text.strip())

    # Convert features to a stable embedding vector
    vector = _features_to_vector(features, text)

    return vector


def _features_to_vector(features: dict, raw_text: str) -> list[float]:
    """
    Convert structured semantic features into a fixed-dimension vector.
    Uses deterministic hashing so the same features always produce the same vector.
    """
    vec = np.zeros(EMBEDDING_DIM, dtype=np.float32)

    # Category encoding (dims 0-31)
    categories = ["apartment", "restaurant", "cafe", "activity", "travel", "shopping", "note", "other"]
    cat = features.get("category", "other").lower()
    cat_idx = categories.index(cat) if cat in categories else 7
    # One-hot with spread
    for i in range(4):
        vec[cat_idx * 4 + i] = 1.0

    # Location keywords (dims 32-95) — hash each keyword into this range
    for kw in features.get("location_keywords", []):
        h = int(hashlib.md5(kw.lower().encode()).hexdigest(), 16)
        idx = 32 + (h % 64)
        vec[idx] += 1.0

    # Attribute keywords (dims 96-175) — hash each keyword into this range
    for kw in features.get("attribute_keywords", []):
        h = int(hashlib.md5(kw.lower().encode()).hexdigest(), 16)
        idx = 96 + (h % 80)
        vec[idx] += 1.0

    # Numeric features (dims 176-185)
    vec[176] = float(features.get("price_level", 0)) / 5.0
    vec[177] = float(features.get("quality_signal", 0)) / 5.0

    # Mood encoding (dims 186-209)
    moods = ["cozy", "energetic", "quiet", "busy", "romantic", "casual", "professional", "fun"]
    mood = features.get("mood", "casual").lower()
    mood_idx = moods.index(mood) if mood in moods else 5
    for i in range(3):
        vec[186 + mood_idx * 3 + i] = 1.0

    # Purpose encoding (dims 210-240)
    purposes = ["living", "dining", "entertainment", "work", "exercise", "shopping", "learning"]
    purpose = features.get("purpose", "other").lower()
    if purpose in purposes:
        purpose_idx = purposes.index(purpose)
        for i in range(4):
            vec[210 + purpose_idx * 4 + i] = 1.0

    # Raw text hash for fine-grained differentiation (dims 241-255)
    words = raw_text.lower().split()
    for word in words:
        h = int(hashlib.md5(word.encode()).hexdigest(), 16)
        idx = 241 + (h % 15)
        vec[idx] += 0.3

    # Normalize the vector
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm

    return vec.tolist()
