from pydantic import BaseModel
from typing import Optional


class Alternative(BaseModel):
    asin: str
    title: str
    score: int
    price_delta: Optional[float] = None   # positive = more expensive, negative = cheaper
    reason: str
    image_url: Optional[str] = None
