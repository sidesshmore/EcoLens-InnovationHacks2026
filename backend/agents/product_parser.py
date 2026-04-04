import re
from models.product import ProductInput

CERT_KEYWORDS = [
    "fair trade", "fairtrade", "usda organic", "organic", "energy star",
    "fsc", "rainforest alliance", "b corp", "bcorp", "epa safer choice",
    "climate pledge friendly", "recycled", "carbon neutral", "bluesign",
]

BRAND_NOISE = re.compile(
    r"^(visit the |by |brand: |sold by )", re.IGNORECASE
)

CATEGORY_MAP = {
    "grocery": "food",
    "food": "food",
    "beverage": "food",
    "clothing": "apparel",
    "shoes": "apparel",
    "fashion": "apparel",
    "electronics": "electronics",
    "computers": "electronics",
    "home": "home",
    "kitchen": "home",
    "beauty": "beauty",
    "health": "health",
    "sports": "sports",
    "outdoors": "sports",
    "toys": "toys",
    "baby": "baby",
    "office": "office",
    "tools": "tools",
    "automotive": "automotive",
}


class ParsedProduct:
    def __init__(self, product: ProductInput, certifications: list[str]):
        self.asin = product.asin
        self.title = product.title
        self.brand = product.brand
        self.category = product.category
        self.materials = product.materials or ""
        self.origin = product.origin or "Unknown"
        self.image_url = product.image_url
        self.climate_pledge_friendly = product.climate_pledge_friendly
        self.certifications = certifications
        self.user_id = product.user_id


def parse(product: ProductInput) -> ParsedProduct:
    brand = BRAND_NOISE.sub("", product.brand).strip()

    # Normalize category
    category_lower = product.category.lower()
    normalized_category = "general"
    for keyword, mapped in CATEGORY_MAP.items():
        if keyword in category_lower:
            normalized_category = mapped
            break

    # Detect certifications from title + description text
    search_text = " ".join(filter(None, [
        product.title,
        product.description,
        product.materials,
    ])).lower()

    certifications = [cert for cert in CERT_KEYWORDS if cert in search_text]

    if product.climate_pledge_friendly and "climate pledge friendly" not in certifications:
        certifications.append("climate pledge friendly")

    parsed = ParsedProduct(
        ProductInput(
            asin=product.asin,
            title=product.title,
            brand=brand,
            category=normalized_category,
            materials=product.materials,
            origin=product.origin,
            image_url=product.image_url,
            climate_pledge_friendly=product.climate_pledge_friendly,
            description=product.description,
            user_id=product.user_id,
        ),
        certifications=certifications,
    )
    return parsed
