"""
Claude Service — Generative Card Creation

Takes raw user input (text, URLs, notes) and asks Claude to generate
a structured card schema with dynamic widgets.
"""

import json
import uuid
import anthropic
from models.schemas import GeneratedCard, Widget


CARD_SYSTEM_PROMPT = """You are a UI card generator for a spatial canvas app called Orbit.

When a user drops content (text, URLs, notes) onto the canvas, you generate a structured JSON card with interactive widgets.

Your job is to:
1. Understand what the content is about (apartment, restaurant, activity, note, etc.)
2. Generate a beautiful card with relevant interactive widgets
3. Choose widgets that make sense for the content type

WIDGET TYPES available:
- "slider": A range slider (needs label, value, min, max). Use for quantifiable attributes like price, noise level, distance.
- "rating": Star rating (needs label, value 1-5). Use for quality assessments.
- "tags": Tag chips (needs label, value as array of strings). Use for categories, features, amenities.
- "text": Text display (needs label, value as string). Use for descriptions, addresses.
- "color_indicator": Color dot with label (needs label, color as hex, value as string). Use for status, mood, vibe.
- "progress": Progress bar (needs label, value 0-100). Use for completion, match percentage.
- "toggle": Boolean toggle (needs label, value as boolean). Use for yes/no features.
- "price": Price display (needs label, value as string like "$2,500/mo"). Use for costs.

RULES:
- Generate 3-6 widgets per card
- Choose an emoji icon that represents the category
- Choose a hex color that fits the category (apartments: #6366f1, restaurants: #f59e0b, activities: #10b981, notes: #8b5cf6, travel: #06b6d4, shopping: #ec4899)
- Keep the summary to 1-2 sentences
- The semantic_text should be a rich description used for embedding — include all key attributes
- Infer reasonable values for widgets based on the content
- For URLs, infer what the site/page is about from the URL text

Respond ONLY with valid JSON matching this exact schema:
{
  "title": "string",
  "summary": "string",
  "category": "string",
  "icon": "emoji",
  "color": "#hexcolor",
  "widgets": [
    {"type": "widget_type", "label": "string", "value": ..., "min": number|null, "max": number|null, "color": "#hex"|null, "icon": "emoji"|null}
  ],
  "semantic_text": "string"
}"""


async def generate_card(content: str, content_type: str = "text") -> GeneratedCard:
    """
    Send user input to Claude, get back a structured card schema.
    """
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
        widgets=widgets,
        raw_input=content,
        semantic_text=card_data["semantic_text"],
    )

    return card


async def evaluate_magnet(constraint: str, cards: list[dict]) -> list[dict]:
    """
    Use Claude to evaluate how relevant each card is to a magnet constraint.
    Returns relevance scores 0.0-1.0 for each card.
    """
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

    return json.loads(response_text.strip())
