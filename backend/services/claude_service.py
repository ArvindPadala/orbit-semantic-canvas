"""
Claude Service — Generative Card Creation

Takes raw user input (text, URLs, notes) and asks Claude to generate
a structured card schema with dynamic widgets.
"""

import json
import uuid
import hashlib
import anthropic
from models.schemas import GeneratedCard, Widget
from services import redis_service


CARD_SYSTEM_PROMPT = """You are a UI card generator for a spatial canvas app called Orbit, configured for Trip Planning.

When a user drops content (text, URLs, notes) onto the canvas, you generate a structured JSON card with interactive widgets.

Your job is to:
1. Understand what the travel content is about (hotel, flight, restaurant, activity, transit, note, etc.)
2. Generate a beautiful card with relevant interactive widgets
3. Choose widgets that make sense for the trip planning content

WIDGET TYPES available:
- "slider": A range slider (needs label, value, min, max). Use for quantifiable attributes like price per night, flight duration, distance.
- "rating": Star rating (needs label, value 1-5). Use for hotel ratings, restaurant reviews.
- "tags": Tag chips (needs label, value as array of strings). Use for amenities (WiFi, Pool), cuisine type, vibes.
- "text": Text display (needs label, value as string). Use for addresses, terminal info, booking refs.
- "color_indicator": Color dot with label (needs label, color as hex, value as string). Use for flight status, reservation status.
- "progress": Progress bar (needs label, value 0-100). Use for itinerary completion.
- "price": Price display (needs label, value as string like "$150/night" or "$400 roundtrip"). Use for costs.

RULES:
- Generate 3-6 widgets per card
- Choose an emoji icon that represents the travel category
- Choose a hex color that fits the category (hotels: #6366f1, flights: #0ea5e9, transit: #64748b, restaurants: #f59e0b, activities: #10b981, notes: #8b5cf6)
- Keep the summary to 1-2 sentences highlighting key travel info
- The semantic_text should be a rich description used for embedding — include all key trip attributes
- Infer reasonable values for widgets based on the content (e.g. realistic prices or ratings)
- For URLs, infer what the site/page is about from the URL text

Respond ONLY with valid JSON matching this exact schema:
{
  "title": "string",
  "summary": "string",
  "category": "string",
  "icon": "emoji",
  "color": "#hexcolor",
  "time_of_day": "one word (morning, afternoon, evening, night, anytime)",
  "widgets": [
    {"type": "widget_type", "label": "string", "value": ..., "min": number|null, "max": number|null, "color": "#hex"|null, "icon": "emoji"|null}
  ],
  "semantic_text": "string"
}"""


async def generate_card(content: str, content_type: str = "text") -> GeneratedCard:
    """
    Send user input to Claude, get back a structured card schema.
    Uses Redis to cache results for identical inputs to save API costs and improve speed.
    """
    # 1. Check Redis cache first
    try:
        content_hash = hashlib.md5(f"{content_type}:{content}".encode()).hexdigest()
        cache_key = f"cache:card:{content_hash}"
        redis_client = redis_service.get_redis_client()
        cached_data = redis_client.get(cache_key)
        
        if cached_data:
            print(f"✨ CACHE HIT for card: {content[:30]}...")
            card_data = json.loads(cached_data)
            redis_client.close()
            
            # Reconstruct the GeneratedCard object from cache
            widgets = [Widget(**w) for w in card_data.get("widgets", [])]
            return GeneratedCard(
                id=str(uuid.uuid4())[:8],  # Generate new ID so duplicates can exist on canvas
                title=card_data["title"],
                summary=card_data["summary"],
                category=card_data["category"],
                icon=card_data["icon"],
                color=card_data["color"],
                time_of_day=card_data.get("time_of_day", "anytime"),
                widgets=widgets,
                raw_input=content,
                semantic_text=card_data["semantic_text"],
            )
        redis_client.close()
    except Exception as e:
        print(f"⚠️ Cache check failed: {e}")

    # 2. Not in cache, call Claude
    print(f"🧠 CALLING CLAUDE for card: {content[:30]}...")
    client = anthropic.AsyncAnthropic()

    user_message = f"Content type: {content_type}\nContent: {content}"

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=CARD_SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )

    # Parse Claude's JSON response
    response_text = response.content[0].text

    # Handle potential markdown code blocks in response
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0]
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0]

    card_data = json.loads(response_text.strip())

    # Build the card
    card_id = str(uuid.uuid4())[:8]

    widgets = []
    for w in card_data.get("widgets", []):
        widgets.append(Widget(
            type=w["type"],
            label=w["label"],
            value=w.get("value"),
            min=w.get("min"),
            max=w.get("max"),
            color=w.get("color"),
            icon=w.get("icon"),
        ))

    card = GeneratedCard(
        id=card_id,
        title=card_data["title"],
        summary=card_data["summary"],
        category=card_data["category"],
        icon=card_data["icon"],
        color=card_data["color"],
        time_of_day=card_data.get("time_of_day", "anytime"),
        widgets=widgets,
        raw_input=content,
        semantic_text=card_data["semantic_text"],
    )

    # 3. Save to Redis cache for future requests (expire after 7 days)
    try:
        redis_client = redis_service.get_redis_client()
        # Cache the parsed data (without the ID, so new IDs get generated on cache hit)
        cache_value = {
            "title": card.title,
            "summary": card.summary,
            "category": card.category,
            "icon": card.icon,
            "color": card.color,
            "time_of_day": card.time_of_day,
            "widgets": [w.model_dump() for w in card.widgets],
            "semantic_text": card.semantic_text,
        }
        redis_client.setex(cache_key, 604800, json.dumps(cache_value))
        redis_client.close()
    except Exception as e:
        print(f"⚠️ Cache save failed: {e}")

    return card


async def evaluate_magnet(constraint: str, cards: list[dict]) -> list[dict]:
    """
    Use Claude to evaluate how relevant each card is to a magnet constraint.
    Returns relevance scores 0.0-1.0 for each card.
    Uses Redis caching to avoid re-evaluating the same cards for the same constraint.
    """
    if not cards:
        return []

    # 1. Check Redis cache first
    try:
        # Create a deterministic hash based on constraint + sorted card IDs
        card_ids = sorted([str(c.get("id", "")) for c in cards])
        ids_string = ",".join(card_ids)
        content_hash = hashlib.md5(f"{constraint}:{ids_string}".encode()).hexdigest()
        cache_key = f"cache:magnet:{content_hash}"
        
        redis_client = redis_service.get_redis_client()
        cached_data = redis_client.get(cache_key)
        
        if cached_data:
            print(f"🧲 CACHE HIT for magnet: '{constraint}' with {len(cards)} cards")
            results = json.loads(cached_data)
            redis_client.close()
            return results
            
        redis_client.close()
    except Exception as e:
        print(f"⚠️ Magnet cache check failed: {e}")

    # 2. Not in cache, call Claude
    print(f"🧠 CALLING CLAUDE for magnet: '{constraint}'...")
    client = anthropic.AsyncAnthropic()

    cards_summary = json.dumps([
        {"id": c["id"], "title": c["title"], "summary": c["summary"], "category": c["category"]}
        for c in cards
    ], indent=2)

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system="""You evaluate how relevant cards are to a user's search constraint.
Return a JSON array of objects with "id" and "relevance" (0.0 to 1.0).
1.0 = perfectly matches the constraint, 0.0 = completely irrelevant.
Respond ONLY with the JSON array, no other text.""",
        messages=[
            {"role": "user", "content": f"Constraint: {constraint}\n\nCards:\n{cards_summary}"}
        ]
    )

    response_text = response.content[0].text
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0]
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0]

    results = json.loads(response_text.strip())

    # 3. Save to Redis cache for future requests (expire after 1 hour)
    try:
        redis_client = redis_service.get_redis_client()
        redis_client.setex(cache_key, 3600, json.dumps(results))
        redis_client.close()
    except Exception as e:
        print(f"⚠️ Magnet cache save failed: {e}")

    return results

async def suggest_next(cards: list[dict]) -> list[str]:
    """
    Look at the current itinerary cards on the canvas and suggest 2 new logical additions.
    For example, if there is a hotel and a morning tour, suggest a lunch spot or afternoon activity.
    """
    if not cards:
        return ["A historic hotel in the city center", "A highly-rated local restaurant"]

    print("🧠 CALLING CLAUDE for suggestions...")
    client = anthropic.AsyncAnthropic()

    cards_summary = json.dumps([
        {"title": c["title"], "summary": c["summary"], "category": c["category"]}
        for c in cards
    ], indent=2)

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=256,
        system="""You are a travel planning assistant. The user has an incomplete itinerary represented by a list of items.
Suggest EXACTLY 2 new, specific things to add to the itinerary to fill gaps (e.g. if they have a morning activity, suggest a lunch spot. If they have a hotel but no activities, suggest a popular activity nearby).
Make the suggestions sound like practical search queries or natural language drops.
Return a JSON array of 2 strings ONLY. Example: ["Lunch at a traditional trattoria nearby", "Afternoon visit to the local art museum"]""",
        messages=[
            {"role": "user", "content": f"Current Itinerary:\n{cards_summary}"}
        ]
    )

    response_text = response.content[0].text
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0]
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0]

    try:
        suggestions = json.loads(response_text.strip())
        return suggestions[:2]
    except Exception as e:
        print(f"Failed to parse suggestions: {e}")
        return ["A local coffee shop", "A scenic walking tour"]

async def export_itinerary(cards: list[dict]) -> str:
    """
    Take all cards on the canvas and format them into a clean, chronological Markdown itinerary.
    """
    if not cards:
        return "No items in itinerary yet."

    print("🧠 CALLING CLAUDE for itinerary export...")
    client = anthropic.AsyncAnthropic()

    cards_summary = json.dumps([
        {
            "title": c["title"], 
            "summary": c["summary"], 
            "category": c["category"],
            "time_of_day": c.get("time_of_day", "anytime")
        }
        for c in cards
    ], indent=2)

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system="""You are a travel planning assistant. The user has arranged a set of travel items on a spatial canvas.
Your job is to synthesize these items into a cohesive, beautifully formatted Markdown itinerary.
Organize items logically by timeline (morning, afternoon, evening). If there are multiple days worth of items, try to group them logically.
Use Markdown headers, bullet points, and basic styling.
Do NOT output anything except the Markdown content itself. Do not write "Here is your itinerary".""",
        messages=[
            {"role": "user", "content": f"Canvas Cards:\n{cards_summary}"}
        ]
    )

    return response.content[0].text.strip()
