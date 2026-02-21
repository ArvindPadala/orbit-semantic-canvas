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
from services import redis_service


EMBEDDING_DIM = 256


async def generate_embedding(text: str) -> list[float]:
    """
    Generate a semantic embedding vector for the given text.

    Strategy: Use Claude to extract structured semantic features,
    then convert those features into a stable numeric vector.
    This gives us meaningful similarity without a dedicated embedding model.
    Uses Redis caching to avoid Claude API calls for previously seen text.
    """
    # 1. Check Redis cache first
    try:
        content_hash = hashlib.md5(text.encode()).hexdigest()
        cache_key = f"cache:embedding:{content_hash}"
        redis_client = redis_service.get_redis_client()
        cached_data = redis_client.get(cache_key)
        
        if cached_data:
            # We don't print here to avoid spamming logs on lots of identical embeddings
            vector = json.loads(cached_data)
            redis_client.close()
            return vector
            
        redis_client.close()
    except Exception as e:
        print(f"⚠️ Embedding cache check failed: {e}")

    # 2. Not in cache, call Claude
    client = anthropic.AsyncAnthropic()

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system="""Extract semantic features from the travel/trip-planning text. Return a JSON object with these exact fields:
{
  "category": "one word category (hotel, flight, restaurant, activity, transit, note, other)",
  "location_keywords": ["list", "of", "location", "words", "like", "neighborhood", "city"],
  "vibe_keywords": ["list", "of", "descriptive", "vibes", "like", "historic", "modern", "nature", "urban"],
  "price_level": 0-5 (0=not applicable, 1=budget, 5=luxury),
  "quality_signal": 0-5 (0=not applicable, 1=poor, 5=excellent),
  "mood": "one word mood (relaxing, adventurous, romantic, family, cultural, party, business, casual)",
  "time_of_day": "one word time (morning, afternoon, evening, night, anytime)"
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

    # 3. Save to Redis cache for future requests (expire after 30 days)
    try:
        redis_client = redis_service.get_redis_client()
        redis_client.setex(cache_key, 2592000, json.dumps(vector))
        redis_client.close()
    except Exception as e:
        print(f"⚠️ Embedding cache save failed: {e}")

    return vector


def _features_to_vector(features: dict, raw_text: str) -> list[float]:
    """
    Convert structured semantic features into a fixed-dimension vector.
    Uses deterministic hashing so the same features always produce the same vector.
    """
    vec = np.zeros(EMBEDDING_DIM, dtype=np.float32)

    # Category encoding (dims 0-31)
    categories = ["hotel", "flight", "restaurant", "activity", "transit", "note", "other", "unknown"]
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

    # Vibe keywords (dims 96-175) — hash each keyword into this range
    for kw in features.get("vibe_keywords", []):
        h = int(hashlib.md5(kw.lower().encode()).hexdigest(), 16)
        idx = 96 + (h % 80)
        vec[idx] += 1.0

    # Numeric features (dims 176-185)
    vec[176] = float(features.get("price_level", 0)) / 5.0
    vec[177] = float(features.get("quality_signal", 0)) / 5.0

    # Mood encoding (dims 186-209)
    moods = ["relaxing", "adventurous", "romantic", "family", "cultural", "party", "business", "casual"]
    mood = features.get("mood", "casual").lower()
    mood_idx = moods.index(mood) if mood in moods else 7
    for i in range(3):
        vec[186 + mood_idx * 3 + i] = 1.0

    # time_of_day encoding (dims 210-240)
    times = ["morning", "afternoon", "evening", "night", "anytime", "unknown"]
    time_of_day = features.get("time_of_day", "anytime").lower()
    if time_of_day in times:
        time_idx = times.index(time_of_day)
        for i in range(5):
            vec[210 + time_idx * 5 + i] = 1.0

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
