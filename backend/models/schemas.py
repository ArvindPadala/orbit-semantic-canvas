"""
Pydantic schemas for Orbit API.
Single source of truth for data shapes — frontend must match these.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class WidgetType(str, Enum):
    SLIDER = "slider"
    RATING = "rating"
    TAGS = "tags"
    TEXT = "text"
    COLOR_INDICATOR = "color_indicator"
    PROGRESS = "progress"
    TOGGLE = "toggle"
    PRICE = "price"


class Widget(BaseModel):
    type: WidgetType
    label: str
    value: Optional[float | str | list[str] | bool] = None
    min_val: Optional[float] = Field(None, alias="min")
    max_val: Optional[float] = Field(None, alias="max")
    color: Optional[str] = None
    icon: Optional[str] = None

    model_config = {"populate_by_name": True}


class CardInput(BaseModel):
    content: str
    type: str = "text"  # "text", "url", "note"


class GeneratedCard(BaseModel):
    id: str
    title: str
    summary: str
    category: str  # e.g., "apartment", "restaurant", "activity", "note"
    icon: str  # emoji icon for the card
    color: str  # hex color for accent
    widgets: list[Widget]
    raw_input: str  # original user input
    semantic_text: str  # text used for embedding


class EmbedRequest(BaseModel):
    card_id: str
    text: str


class EmbedResponse(BaseModel):
    card_id: str
    success: bool


class GravityRequest(BaseModel):
    card_ids: list[str]


class SimilarityPair(BaseModel):
    card_a: str
    card_b: str
    similarity: float


class GravityResponse(BaseModel):
    pairs: list[SimilarityPair]


class MagnetRequest(BaseModel):
    constraint: str
    card_ids: list[str]


class MagnetResult(BaseModel):
    card_id: str
    relevance: float  # 0.0 to 1.0


class MagnetResponse(BaseModel):
    results: list[MagnetResult]
