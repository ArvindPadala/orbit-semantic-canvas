"""
Orbit Backend — FastAPI Application

Main API server for the Orbit semantic canvas.
Endpoints:
  - POST /api/generate-card — Claude generates a card from raw input
  - POST /api/embed — Generate and store embedding for a card
  - POST /api/gravity — Get similarity scores between cards
  - POST /api/magnet — Evaluate card relevance to a constraint
  - GET  /health — Health check with Redis/Claude status
"""

import os
import json
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models.schemas import CardInput, GeneratedCard, EmbedRequest, EmbedResponse, GravityRequest, GravityResponse, SimilarityPair, MagnetRequest, MagnetResponse, MagnetResult, SuggestRequest, SuggestResponse, ExportRequest, ExportResponse
from services import claude_service, embedding_service, redis_service

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# Store generated cards in memory for quick access (also in Redis)
cards_store: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Try to connect to Redis and create index on startup
    try:
        client = redis_service.get_redis_client()
        redis_service.ensure_index(client)
        client.close()
        print("✅ Redis connected and index ready")
    except Exception as e:
        print(f"⚠️  Redis not available: {e}")
        print("   App will still run, but gravity features will be disabled")
    yield


app = FastAPI(
    title="Orbit API",
    description="Semantic Canvas Backend — Claude + Redis Vector Search",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint with dependency status."""
    redis_ok = await redis_service.check_redis_connection()
    claude_ok = bool(os.getenv("ANTHROPIC_API_KEY"))

    return {
        "status": "ok" if (redis_ok and claude_ok) else "degraded",
        "redis": "connected" if redis_ok else "disconnected",
        "claude": "configured" if claude_ok else "missing_api_key",
        "cards_in_memory": len(cards_store),
    }


@app.post("/api/generate-card", response_model=GeneratedCard)
async def generate_card(input_data: CardInput):
    """
    Generate a card from raw user input using Claude.
    Claude determines the card type, title, widgets, and visual properties.
    """
    try:
        card = await claude_service.generate_card(
            content=input_data.content,
            content_type=input_data.type,
        )

        # Store in memory
        cards_store[card.id] = card.model_dump()

        # Auto-embed the card (non-blocking in production, but sync here for simplicity)
        try:
            embedding = await embedding_service.generate_embedding(card.semantic_text)
            await redis_service.store_card_embedding(
                card_id=card.id,
                title=card.title,
                category=card.category,
                summary=card.summary,
                embedding=embedding,
            )
        except Exception as e:
            print(f"⚠️  Embedding/Redis storage failed for card {card.id}: {e}")
            # Card still works without embedding — gravity just won't include it

        return card

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Card generation failed: {str(e)}")


@app.post("/api/embed", response_model=EmbedResponse)
async def embed_card(request: EmbedRequest):
    """Generate and store an embedding for a card."""
    try:
        embedding = await embedding_service.generate_embedding(request.text)
        await redis_service.store_card_embedding(
            card_id=request.card_id,
            title=request.text[:50],
            category="unknown",
            summary=request.text,
            embedding=embedding,
        )
        return EmbedResponse(card_id=request.card_id, success=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")


@app.post("/api/gravity", response_model=GravityResponse)
async def get_gravity(request: GravityRequest):
    """
    Get pairwise similarity scores between cards for gravity simulation.
    The frontend uses these scores to position cards — higher similarity = closer together.
    """
    try:
        pairs = await redis_service.get_similarity_pairs(request.card_ids)
        return GravityResponse(
            pairs=[
                SimilarityPair(
                    card_a=p["card_a"],
                    card_b=p["card_b"],
                    similarity=p["similarity"],
                )
                for p in pairs
            ]
        )
    except Exception as e:
        # Graceful degradation — return empty pairs if Redis is down
        print(f"⚠️  Gravity calculation failed: {e}")
        return GravityResponse(pairs=[])


@app.post("/api/magnet", response_model=MagnetResponse)
async def apply_magnet(request: MagnetRequest):
    """
    Evaluate how relevant each card is to a magnet's constraint.
    Uses Claude to score relevance — cards with high scores get pulled toward the magnet.
    """
    try:
        # Get card data from memory
        cards_data = []
        for card_id in request.card_ids:
            if card_id in cards_store:
                cards_data.append(cards_store[card_id])
            else:
                cards_data.append({"id": card_id, "title": "Unknown", "summary": "", "category": "unknown"})

        results = await claude_service.evaluate_magnet(request.constraint, cards_data)

        return MagnetResponse(
            results=[
                MagnetResult(card_id=r["id"], relevance=r["relevance"])
                for r in results
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Magnet evaluation failed: {str(e)}")


@app.post("/api/suggest", response_model=SuggestResponse)
async def get_suggestions(request: SuggestRequest):
    """
    Get 2 new itinerary suggestions based on the cards currently on the canvas.
    """
    try:
        suggestions = await claude_service.suggest_next(request.cards)
        return SuggestResponse(suggestions=suggestions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Suggest failed: {str(e)}")


@app.post("/api/export", response_model=ExportResponse)
async def export_itinerary(request: ExportRequest):
    """
    Export current canvas cards to a formatted Markdown itinerary.
    """
    try:
        markdown = await claude_service.export_itinerary(request.cards)
        return ExportResponse(markdown=markdown)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@app.get("/api/cards")
async def get_all_cards():
    """Get all cards currently in memory."""
    return {"cards": list(cards_store.values())}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
