"""
Redis Service — Vector Search for Semantic Gravity

Manages the Redis vector index, stores card embeddings, and
computes similarity scores between cards for the gravity simulation.
"""

import os
import json
import numpy as np
import redis
from redis.commands.search.field import VectorField, TextField, TagField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis.commands.search.query import Query


EMBEDDING_DIM = 256
INDEX_NAME = "orbit_cards_idx"
KEY_PREFIX = "card:"


def get_redis_client():
    """Get a Redis client from environment config."""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    return redis.from_url(redis_url, decode_responses=False)


def ensure_index(client):
    """Create the vector search index if it doesn't exist."""
    try:
        client.ft(INDEX_NAME).info()
        return  # Index already exists
    except Exception:
        pass

    schema = (
        TextField("$.title", as_name="title"),
        TextField("$.category", as_name="category"),
        TextField("$.summary", as_name="summary"),
        VectorField(
            "$.embedding",
            "FLAT",
            {
                "TYPE": "FLOAT32",
                "DIM": EMBEDDING_DIM,
                "DISTANCE_METRIC": "COSINE",
            },
            as_name="embedding",
        ),
    )

    definition = IndexDefinition(
        prefix=[KEY_PREFIX],
        index_type=IndexType.JSON,
    )

    client.ft(INDEX_NAME).create_index(schema, definition=definition)


async def store_card_embedding(card_id: str, title: str, category: str, summary: str, embedding: list[float]):
    """Store a card's data and embedding in Redis."""
    client = get_redis_client()
    ensure_index(client)

    key = f"{KEY_PREFIX}{card_id}"

    card_data = {
        "title": title,
        "category": category,
        "summary": summary,
        "embedding": embedding,
    }

    client.json().set(key, "$", card_data)
    client.close()


async def get_similarity_pairs(card_ids: list[str]) -> list[dict]:
    """
    Compute pairwise similarity between all given cards using their stored embeddings.
    Returns a list of {card_a, card_b, similarity} pairs.
    """
    if len(card_ids) < 2:
        return []

    client = get_redis_client()

    # Retrieve all embeddings
    embeddings = {}
    for card_id in card_ids:
        key = f"{KEY_PREFIX}{card_id}"
        try:
            data = client.json().get(key, "$.embedding")
            if data and len(data) > 0:
                embeddings[card_id] = np.array(data[0], dtype=np.float32)
        except Exception:
            continue

    client.close()

    # Compute pairwise cosine similarity
    pairs = []
    ids = list(embeddings.keys())

    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            vec_a = embeddings[ids[i]]
            vec_b = embeddings[ids[j]]

            # Cosine similarity
            dot = np.dot(vec_a, vec_b)
            norm_a = np.linalg.norm(vec_a)
            norm_b = np.linalg.norm(vec_b)

            if norm_a > 0 and norm_b > 0:
                similarity = float(dot / (norm_a * norm_b))
            else:
                similarity = 0.0

            pairs.append({
                "card_a": ids[i],
                "card_b": ids[j],
                "similarity": similarity,
            })

    return pairs


async def search_similar(query_embedding: list[float], top_k: int = 10) -> list[dict]:
    """Search for cards similar to the given embedding."""
    client = get_redis_client()
    ensure_index(client)

    query_bytes = np.array(query_embedding, dtype=np.float32).tobytes()

    q = (
        Query(f"*=>[KNN {top_k} @embedding $query_vec AS score]")
        .sort_by("score")
        .return_fields("title", "category", "summary", "score")
        .dialect(2)
    )

    results = client.ft(INDEX_NAME).search(q, query_params={"query_vec": query_bytes})
    client.close()

    return [
        {
            "id": doc.id.replace(KEY_PREFIX, ""),
            "title": doc.title,
            "category": doc.category,
            "score": float(doc.score),
        }
        for doc in results.docs
    ]


async def check_redis_connection() -> bool:
    """Check if Redis is reachable."""
    try:
        client = get_redis_client()
        client.ping()
        client.close()
        return True
    except Exception:
        return False
