import json
import time
from pathlib import Path
from config.gemini import call_with_fallback, GeminiAgent
from agents.product_parser import ParsedProduct
from cache.supabase_cache import log_agent_action
import os

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "sustainability_research.txt"
M2M_CLIENT_ID = os.getenv("AUTH0_M2M_CLIENT_ID", "")


class GeminiResearchResult:
    def __init__(self, scores: dict, evidence: dict, data_sources: list[str]):
        self.carbon: float = scores.get("carbon", 50)
        self.packaging: float = scores.get("packaging", 50)
        self.brand_ethics: float = scores.get("brand_ethics", 50)
        self.certifications: float = scores.get("certifications", 50)
        self.durability: float = scores.get("durability", 50)
        self.evidence = evidence
        self.data_sources = data_sources


def _safe(value: str | None) -> str:
    """Escape curly braces in user-supplied strings so str.format() won't misinterpret them."""
    return str(value or "").replace("{", "{{").replace("}", "}}")


async def research(product: ParsedProduct) -> GeminiResearchResult:
    _FALLBACK = {
        "carbon": 50, "packaging": 50, "brand_ethics": 50,
        "certifications": 50, "durability": 50,
        "evidence": {}, "data_sources": [],
    }

    start = time.monotonic()
    data = _FALLBACK.copy()

    try:
        template = PROMPT_PATH.read_text()
        prompt = template.format(
            title=_safe(product.title),
            brand=_safe(product.brand),
            category=_safe(product.category),
            materials=_safe(product.materials) or "Not specified",
            origin=_safe(product.origin),
            certifications=_safe(", ".join(product.certifications)) or "None detected",
            climate_pledge_friendly=product.climate_pledge_friendly,
        )
        raw = await call_with_fallback(
            agent=GeminiAgent.RESEARCH,
            prompt=prompt,
            system_instruction="You are a sustainability analyst. Always respond with valid JSON only.",
            timeout_seconds=30,
        )
        data = json.loads(raw)
    except Exception as e:
        print(f"[EcoLens] GeminiResearch fallback for {product.asin}: {type(e).__name__}: {str(e)[:200]}")
        data = _FALLBACK.copy()

    latency = int((time.monotonic() - start) * 1000)
    try:
        log_agent_action(
            agent_name="gemini_research",
            auth0_client_id=M2M_CLIENT_ID,
            asin=product.asin,
            action="score",
            input_payload=product.asin,
            output_payload=str(data.get("carbon", "")),
            latency_ms=latency,
        )
    except Exception:
        pass  # audit log is non-critical

    return GeminiResearchResult(
        scores=data,
        evidence=data.get("evidence", {}),
        data_sources=data.get("data_sources", ["Gemini Research"]),
    )
