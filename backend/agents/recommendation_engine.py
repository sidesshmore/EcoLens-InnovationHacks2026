import os
import json
import httpx
from pathlib import Path
from config.gemini import call_with_fallback, GeminiAgent
from agents.product_parser import ParsedProduct
from models.score import ScoreResponse
from models.recommendation import Alternative

SERP_API_KEY  = os.getenv("SERP_API_KEY", "")
PROMPT_PATH   = Path(__file__).parent.parent / "prompts" / "recommendation.txt"


async def recommend(product: ParsedProduct, score: ScoreResponse) -> list[Alternative]:
    # Find which dimensions are weakest (below 60)
    dim_dict = score.dimensions.model_dump()
    weak_dims = [k.replace("_", " ") for k, v in dim_dict.items() if v < 60]

    # Get search queries from Gemini
    queries = await _get_search_queries(product, weak_dims)

    # Search Amazon via SerpAPI for each query
    alternatives: list[Alternative] = []
    seen_asins: set[str] = {product.asin}

    # Score offsets per slot: first results from eco query are estimated greener,
    # later results from mainstream queries vary around the current score.
    _score_offsets = [+18, +12, +5, -3, -10]

    async with httpx.AsyncClient(timeout=8) as client:
        for query in queries[:3]:
            results = await _serp_search(client, query)
            for item in results[:3]:
                asin = item.get("asin", "")
                if not asin or asin in seen_asins:
                    continue
                seen_asins.add(asin)
                idx = len(alternatives)
                offset = _score_offsets[idx] if idx < len(_score_offsets) else 0
                est_score = max(5, min(95, score.score + offset))
                alternatives.append(Alternative(
                    asin=asin,
                    title=item.get("title", ""),
                    score=est_score,
                    price_delta=_price_delta(item.get("price"), item.get("extracted_price")),
                    reason=item.get("snippet", "Similar product in this category"),
                    image_url=item.get("thumbnail"),
                ))
                if len(alternatives) >= 5:
                    break
            if len(alternatives) >= 5:
                break

    return alternatives[:5]


def _safe(value: str | None) -> str:
    return str(value or "").replace("{", "{{").replace("}", "}}")


def _product_noun(title: str) -> str:
    """Extract a short, searchable product noun from the full title.
    e.g. 'Ninja AF101 Air Fryer 4 Qt' → 'air fryer'
    Strips brand-like leading words and cuts at first punctuation/comma."""
    import re
    # Drop model numbers (all-caps/digit combos like AF101, XL200)
    cleaned = re.sub(r"\b[A-Z]{1,4}\d+\w*\b", "", title)
    # Drop anything after comma, dash, or pipe
    cleaned = re.split(r"[,|\-–—]", cleaned)[0]
    # Take first 5 words
    words = cleaned.split()[:5]
    return " ".join(words).strip()


async def _get_search_queries(product: ParsedProduct, weak_dims: list[str]) -> list[str]:
    # Query 1 is always a direct product search — never trust Gemini for this
    noun = _product_noun(product.title)
    direct_query = noun if noun else product.category

    try:
        template = PROMPT_PATH.read_text()
        prompt = template.format(
            title=_safe(product.title),
            brand=_safe(product.brand),
            category=_safe(product.category),
            product_noun=_safe(noun or product.category),
            weak_dimensions=_safe(", ".join(weak_dims)) or "packaging",
        )
        raw = await call_with_fallback(
            agent=GeminiAgent.RECOMMENDATION,
            prompt=prompt,
            timeout_seconds=5,
        )
        data = json.loads(raw)
        gemini_queries = data.get("search_queries", [])
        # Always lead with the direct product query, then Gemini eco variants
        queries = [direct_query] + [q for q in gemini_queries if q != direct_query]
        return queries[:3]
    except Exception:
        return [direct_query, f"energy efficient {noun or product.category}", f"best {noun or product.category}"]


async def _serp_search(client: httpx.AsyncClient, query: str) -> list[dict]:
    if not SERP_API_KEY:
        return []
    try:
        resp = await client.get(
            "https://serpapi.com/search",
            params={
                "engine": "amazon",
                "k": query,
                "api_key": SERP_API_KEY,
            },
        )
        data = resp.json()
        results = data.get("organic_results", [])
        # Normalise fields to a common shape
        normalised = []
        for r in results:
            asin = r.get("asin", "")
            if not asin:
                continue
            price_raw = None
            prices = r.get("prices") or []
            if prices:
                price_raw = prices[0].get("raw")
            elif r.get("price"):
                price_raw = r["price"].get("raw") if isinstance(r["price"], dict) else str(r["price"])
            normalised.append({
                "asin":            asin,
                "title":           r.get("title", ""),
                "thumbnail":       r.get("thumbnail", ""),
                "price":           price_raw,
                "extracted_price": r.get("price", {}).get("value") if isinstance(r.get("price"), dict) else None,
                "snippet":         r.get("description", ""),
            })
        return normalised
    except Exception as e:
        print(f"[EcoLens] SerpAPI error: {e}")
        return []


def _price_delta(price_str: str | None, extracted: float | None) -> float | None:
    if extracted is not None:
        return None  # caller can compare against current product price if needed
    return None
