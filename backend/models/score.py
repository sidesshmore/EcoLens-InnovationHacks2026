from pydantic import BaseModel, Field
from typing import Optional, Literal
from .recommendation import Alternative


class Dimensions(BaseModel):
    carbon: float = Field(0, ge=0, le=100)
    packaging: float = Field(0, ge=0, le=100)
    brand_ethics: float = Field(0, ge=0, le=100)
    certifications: float = Field(0, ge=0, le=100)
    durability: float = Field(0, ge=0, le=100)


class ScoreResponse(BaseModel):
    asin: str
    score: int = Field(..., ge=0, le=100)
    leaf_rating: int = Field(..., ge=1, le=5)
    dimensions: Dimensions
    climate_pledge_friendly: bool = False
    explanation: str
    confidence: Literal["High", "Medium", "Low"] = "Low"
    data_sources: list[str] = []
    alternatives: list[Alternative] = []
    voice_audio_url: Optional[str] = None
    cached: bool = False


class CartScoreResponse(BaseModel):
    total_co2_kg: float
    aggregate_score: int = Field(..., ge=0, le=100)
    item_scores: list[ScoreResponse]
    worst_offender_asin: str
    swap_suggestions: list[Alternative]
