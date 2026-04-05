import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

# Load from repo root regardless of where uvicorn is invoked from
_root = Path(__file__).parent.parent
load_dotenv(_root / ".env.local")

from fastapi import FastAPI, Depends, HTTPException, Request as _Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
from collections import defaultdict
from datetime import date as _date
from typing import Literal
from pydantic import BaseModel

from models import ProductInput, CartInput, ScoreResponse, CartScoreResponse
from auth.auth0 import get_current_user
from cache.supabase_cache import (
    get_cached_score, save_score, save_scan, upsert_user, get_user_stats
)
from agents import product_parser, database_lookup, gemini_research, score_aggregator, recommendation_engine
from voice.elevenlabs import get_or_generate_audio

app = FastAPI(title="EcoLens API", version="1.0.0")

# ── Always return JSON errors (never plain-text "Internal Server Error") ──────

@app.exception_handler(Exception)
async def _global_exception_handler(request: _Request, exc: Exception):
    import traceback
    print(f"[EcoLens] Unhandled exception on {request.url.path}: {type(exc).__name__}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {str(exc)[:200]}"},
    )

@app.exception_handler(RequestValidationError)
async def _validation_handler(request: _Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

# Guest rate limiting (in-memory, keyed by IP)
_GUEST_LIMIT = 3
_guest_counts: dict[str, tuple[_date, int]] = defaultdict(lambda: (_date.today(), 0))

def _check_guest_limit(request: Request) -> None:
    ip = get_remote_address(request)
    today = _date.today()
    last_date, count = _guest_counts[ip]
    if last_date < today:
        _guest_counts[ip] = (today, 1)
        return
    if count >= _GUEST_LIMIT:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded: {_GUEST_LIMIT} per 1 day")
    _guest_counts[ip] = (today, count + 1)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # tighten to extension ID + dashboard URL in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "EcoLens API"}


@app.post("/api/score", response_model=ScoreResponse)
async def score_product(
    request: Request,
    product: ProductInput,
    user: dict | None = Depends(get_current_user),
):
    # Authenticated users get unlimited scans; guests limited to 3/day by IP
    is_real_user = user and "@clients" not in user.get("sub", "")
    if is_real_user:
        try:
            upsert_user(user["sub"], user.get("email", ""))
        except Exception as e:
            print(f"[EcoLens] upsert_user failed (non-fatal): {e}")
    elif not user:
        _check_guest_limit(request)

    # 1. Check cache first
    try:
        cached = get_cached_score(product.asin)
    except Exception as e:
        print(f"[EcoLens] Cache read failed for {product.asin} (non-fatal): {e}")
        cached = None
    if cached:
        # If cached result has no alternatives, backfill them now
        if not cached.alternatives:
            try:
                parsed_for_alts = product_parser.parse(product)
                alts = await recommendation_engine.recommend(parsed_for_alts, cached)
                if alts:
                    cached.alternatives = alts
                    save_score(cached)
            except Exception as e:
                print(f"[EcoLens] Backfill alternatives failed (non-fatal): {e}")
        if is_real_user:
            try:
                save_scan(user["sub"], product.asin, product.title, cached.score,
                          _co2_kg(cached.score))
            except Exception as e:
                print(f"[EcoLens] save_scan failed (non-fatal): {e}")
        return cached

    # 2. Parse product
    parsed = product_parser.parse(product)

    # 3. Run parallel agents — capture exceptions so one failing agent doesn't kill the request
    _results = await asyncio.gather(
        database_lookup.lookup(parsed),
        gemini_research.research(parsed),
        return_exceptions=True,
    )
    from agents.database_lookup import DatabaseLookupResult
    from agents.gemini_research import GeminiResearchResult
    db_result = _results[0] if not isinstance(_results[0], BaseException) else DatabaseLookupResult()
    gemini_result = _results[1] if not isinstance(_results[1], BaseException) else GeminiResearchResult({}, {}, [])
    if isinstance(_results[0], BaseException):
        print(f"[EcoLens] DatabaseLookup failed for {product.asin}: {_results[0]}")
    if isinstance(_results[1], BaseException):
        print(f"[EcoLens] GeminiResearch failed for {product.asin}: {_results[1]}")

    # 4. Aggregate score
    score = await score_aggregator.aggregate(parsed, db_result, gemini_result)

    # 5. Get greener alternatives
    try:
        alternatives = await recommendation_engine.recommend(parsed, score)
        score.alternatives = alternatives
    except Exception:
        pass  # alternatives are optional

    # 6. Cache result (non-fatal)
    try:
        save_score(score)
    except Exception as e:
        print(f"[EcoLens] save_score failed for {product.asin} (non-fatal): {e}")

    # 7. Save scan to history (real users only, not M2M) — non-fatal
    if is_real_user:
        try:
            save_scan(user["sub"], product.asin, product.title, score.score,
                      _co2_kg(score.score))
        except Exception as e:
            print(f"[EcoLens] save_scan failed (non-fatal): {e}")

    return score


@app.post("/api/score/cart", response_model=CartScoreResponse)
async def score_cart(
    cart: CartInput,
    user: dict | None = Depends(get_current_user),
):
    # Score all items (use cache where available)
    tasks = [_score_single(item, user) for item in cart.items]
    item_scores: list[ScoreResponse] = await asyncio.gather(*tasks)

    total_co2 = sum(max(0, (70 - s.score) * 0.018) for s in item_scores)
    aggregate_score = round(sum(s.score for s in item_scores) / len(item_scores)) if item_scores else 0
    worst = min(item_scores, key=lambda s: s.score)

    # Collect swap suggestions from the worst offender
    swap_suggestions = worst.alternatives[:2]

    return CartScoreResponse(
        total_co2_kg=round(total_co2, 2),
        aggregate_score=aggregate_score,
        item_scores=item_scores,
        worst_offender_asin=worst.asin,
        swap_suggestions=swap_suggestions,
    )


@app.get("/api/voice/{asin}")
async def voice_briefing(
    asin: str,
    user: dict | None = Depends(get_current_user),
):
    cached = get_cached_score(asin)
    if not cached:
        raise HTTPException(status_code=404, detail="Score not found. Visit the product page first.")

    audio_url = await get_or_generate_audio(
        asin=asin,
        title=asin,                   # will use cached score title in prod
        brand="",
        score=cached.score,
        leaf_rating=cached.leaf_rating,
        explanation=cached.explanation,
        alternatives=[a.model_dump() for a in cached.alternatives],
        cached_url=cached.voice_audio_url,
    )

    if not audio_url:
        raise HTTPException(status_code=503, detail="Voice generation unavailable.")

    return {"audio_url": audio_url}


@app.post("/api/feedback")
async def submit_feedback(
    asin: str,
    reported_score: int,
    suggested_correction: str | None = None,
    user: dict | None = Depends(get_current_user),
):
    from supabase import create_client
    db = create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))
    db.table("feedback").insert({
        "user_id": user["sub"] if user else None,
        "asin": asin,
        "reported_score": reported_score,
        "suggested_correction": suggested_correction,
    }).execute()
    return {"status": "received"}


class DecisionInput(BaseModel):
    asin: str
    decision: Literal["buy", "skip"]
    co2_kg: float = 0.0


@app.post("/api/decision")
async def record_decision(
    body: DecisionInput,
    user: dict | None = Depends(get_current_user),
):
    """Record a buy/skip decision. Credits CO₂ savings to authenticated users on skip."""
    if body.decision == "skip" and user:
        sub = user.get("sub", "")
        if sub and "@clients" not in sub:
            try:
                from cache.supabase_cache import record_skip_decision
                record_skip_decision(sub, body.asin, body.co2_kg)
            except Exception:
                pass
    return {"ok": True, "co2_credited": body.co2_kg if body.decision == "skip" else 0}


@app.get("/api/impact/global")
async def global_impact():
    """Aggregate CO₂ impact across all EcoLens users — for the community counter."""
    from cache.supabase_cache import get_global_impact
    return get_global_impact()


@app.get("/api/user/stats")
async def user_stats(user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    sub = user["sub"]
    # M2M tokens have sub like "clientid@clients" — not a UUID, no user row exists
    if "@clients" in sub:
        return {"total_co2_saved_kg": 0.0, "scan_streak": 0, "scan_count": 0}
    return get_user_stats(sub)


# ── helpers ──────────────────────────────────────────────────────────────────

def _co2_kg(score: int) -> float:
    """
    Estimate kg CO₂ avoided vs the average Amazon product (baseline score 50).
    Products scoring above 50 avoided some carbon; at or below 50 → 0.
    Scale: score 100 = 1.0 kg avoided, score 50 = 0, score <50 = 0.
    """
    return round(max(0.0, (score - 50) * 0.02), 3)

async def _score_single(product: ProductInput, user: dict | None) -> ScoreResponse:
    cached = get_cached_score(product.asin)
    if cached:
        return cached
    parsed = product_parser.parse(product)
    from agents.database_lookup import DatabaseLookupResult
    from agents.gemini_research import GeminiResearchResult
    _results = await asyncio.gather(
        database_lookup.lookup(parsed),
        gemini_research.research(parsed),
        return_exceptions=True,
    )
    db_r = _results[0] if not isinstance(_results[0], BaseException) else DatabaseLookupResult()
    gm_r = _results[1] if not isinstance(_results[1], BaseException) else GeminiResearchResult({}, {}, [])
    score = await score_aggregator.aggregate(parsed, db_r, gm_r)
    save_score(score)
    return score
