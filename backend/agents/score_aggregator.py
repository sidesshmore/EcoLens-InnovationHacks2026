import json
import time
from pathlib import Path
from config.gemini import call_with_fallback, GeminiAgent
from agents.product_parser import ParsedProduct
from agents.database_lookup import DatabaseLookupResult
from agents.gemini_research import GeminiResearchResult
from models.score import ScoreResponse, Dimensions
from cache.supabase_cache import log_agent_action
import os

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "score_aggregator.txt"
M2M_CLIENT_ID = os.getenv("AUTH0_M2M_CLIENT_ID", "")

WEIGHTS = {
    "carbon": 0.30,
    "packaging": 0.20,
    "brand_ethics": 0.25,
    "certifications": 0.15,
    "durability": 0.10,
}
CPF_BONUS = 10


def _leaf_rating(score: int) -> int:
    if score >= 80: return 5
    if score >= 60: return 4
    if score >= 40: return 3
    if score >= 20: return 2
    return 1


def _confidence(db: DatabaseLookupResult, gemini: GeminiResearchResult) -> str:
    sources = len(set(db.data_sources + gemini.data_sources))
    if sources >= 3: return "High"
    if sources >= 2: return "Medium"
    return "Low"


async def aggregate(
    product: ParsedProduct,
    db: DatabaseLookupResult,
    gemini: GeminiResearchResult,
) -> ScoreResponse:
    # Merge scores — prefer external DB data over Gemini where available
    dims = Dimensions(
        carbon=gemini.carbon,
        packaging=gemini.packaging,
        brand_ethics=db.brand_ethics_score if db.brand_ethics_score is not None else gemini.brand_ethics,
        certifications=db.certifications_score if db.certifications_score is not None else gemini.certifications,
        durability=gemini.durability,
    )

    raw = (
        dims.carbon        * WEIGHTS["carbon"] +
        dims.packaging     * WEIGHTS["packaging"] +
        dims.brand_ethics  * WEIGHTS["brand_ethics"] +
        dims.certifications * WEIGHTS["certifications"] +
        dims.durability    * WEIGHTS["durability"]
    )

    if product.climate_pledge_friendly:
        raw = min(100, raw + CPF_BONUS)

    score = round(raw)
    leaf = _leaf_rating(score)
    confidence = _confidence(db, gemini)

    # Build data sources list
    sources = list(set(db.data_sources + gemini.data_sources))
    if product.climate_pledge_friendly:
        sources.append("Amazon Climate Pledge Badge")
    if not sources:
        sources = ["Gemini Research"]

    # Get dimension names for explanation prompt
    dim_dict = dims.model_dump()
    strongest = max(dim_dict, key=dim_dict.get)
    weakest   = min(dim_dict, key=dim_dict.get)

    explanation = await _generate_explanation(product, score, leaf, strongest, weakest, dim_dict)

    start = time.monotonic()
    result = ScoreResponse(
        asin=product.asin,
        score=score,
        leaf_rating=leaf,
        dimensions=dims,
        climate_pledge_friendly=product.climate_pledge_friendly,
        explanation=explanation,
        confidence=confidence,
        data_sources=sources,
        alternatives=[],  # filled by RecommendationEngine
        voice_audio_url=None,
        cached=False,
    )
    latency = int((time.monotonic() - start) * 1000)
    try:
        log_agent_action(
            agent_name="score_aggregator",
            auth0_client_id=M2M_CLIENT_ID,
            asin=product.asin,
            action="score",
            input_payload=f"{product.asin}:{score}",
            output_payload=str(score),
            latency_ms=latency,
        )
    except Exception:
        pass  # audit log is non-critical
    return result


def _safe(value: str | None) -> str:
    return str(value or "").replace("{", "{{").replace("}", "}}")


async def _generate_explanation(
    product: ParsedProduct, score: int, leaf: int,
    strongest: str, weakest: str, dim_dict: dict,
) -> str:
    try:
        template = PROMPT_PATH.read_text()
        prompt = template.format(
            title=_safe(product.title),
            brand=_safe(product.brand),
            score=score,
            leaf_rating=leaf,
            strongest_dimension=strongest.replace("_", " "),
            strongest_score=round(dim_dict[strongest]),
            weakest_dimension=weakest.replace("_", " "),
            weakest_score=round(dim_dict[weakest]),
            climate_pledge_friendly=product.climate_pledge_friendly,
            alternative_hint="a certified alternative in this category",
        )
        raw = await call_with_fallback(
            agent=GeminiAgent.AGGREGATOR,
            prompt=prompt,
            timeout_seconds=20,
        )
        return json.loads(raw).get("explanation", "")
    except Exception:
        return f"This product scores {score}/100 based on its sustainability profile."
