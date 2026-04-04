from pydantic import BaseModel
from typing import Optional


class ProductInput(BaseModel):
    asin: str
    title: str
    brand: str
    category: str
    materials: Optional[str] = None
    origin: Optional[str] = None
    image_url: Optional[str] = None
    climate_pledge_friendly: bool = False
    description: Optional[str] = None   # raw listing text for cert detection
    user_id: Optional[str] = None       # Auth0 sub, None for guests


class CartInput(BaseModel):
    items: list[ProductInput]
    user_id: Optional[str] = None
