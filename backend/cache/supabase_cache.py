import os
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from supabase import create_client, Client
from models.score import ScoreResponse, Dimensions
from models.recommendation import Alternative


def _sub_to_uuid(sub: str) -> str:
    """Convert any Auth0 sub (google-oauth2|xxx, auth0|xxx, etc.) to a stable UUID."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, sub))

SUPABASE_URL  = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_cached_score(asin: str) -> Optional[ScoreResponse]:
    db = _client()
    now = datetime.now(timezone.utc).isoformat()
    row = (
        db.table("scores_cache")
        .select("*")
        .eq("asin", asin)
        .gt("expires_at", now)
        .maybe_single()
        .execute()
    )
    if not row or not row.data:
        return None

    d = row.data
    return ScoreResponse(
        asin=d["asin"],
        score=d["score"],
        leaf_rating=d["leaf_rating"],
        dimensions=Dimensions(**d["dimensions"]),
        climate_pledge_friendly=d["climate_pledge_friendly"],
        explanation=d["explanation"] or "",
        confidence=d["confidence"],
        data_sources=d["data_sources"] or [],
        alternatives=[Alternative(**a) for a in (d["alternatives"] or [])],
        voice_audio_url=d["voice_audio_url"],
        cached=True,
    )


def save_score(score: ScoreResponse) -> None:
    db = _client()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    db.table("scores_cache").upsert({
        "asin": score.asin,
        "score": score.score,
        "leaf_rating": score.leaf_rating,
        "dimensions": score.dimensions.model_dump(),
        "climate_pledge_friendly": score.climate_pledge_friendly,
        "explanation": score.explanation,
        "confidence": score.confidence,
        "data_sources": score.data_sources,
        "alternatives": [a.model_dump() for a in score.alternatives],
        "voice_audio_url": score.voice_audio_url,
        "expires_at": expires_at,
    }).execute()


def save_scan(user_id: str, asin: str, product_title: str, score: int, co2_saved_kg: float = 0) -> None:
    db = _client()
    db.table("scans").insert({
        "user_id": _sub_to_uuid(user_id),
        "asin": asin,
        "product_title": product_title,
        "score": score,
        "co2_saved_kg": co2_saved_kg,
    }).execute()
    if co2_saved_kg > 0:
        db.rpc("record_co2_saved", {
            "p_user_id": _sub_to_uuid(user_id),
            "p_co2_kg": co2_saved_kg,
        }).execute()


def get_user_stats(user_id: str) -> dict:
    db = _client()
    uid = _sub_to_uuid(user_id)
    row = db.table("users").select("*").eq("id", uid).maybe_single().execute()
    if not row or not row.data:
        return {"total_co2_saved_kg": 0, "scan_streak": 0, "scan_count": 0}
    scan_count = db.table("scans").select("id", count="exact").eq("user_id", uid).execute()
    return {
        "total_co2_saved_kg": row.data["total_co2_saved_kg"],
        "scan_streak": row.data["scan_streak"],
        "scan_count": scan_count.count or 0,
    }


def upsert_user(user_id: str, email: str) -> None:
    db = _client()
    db.table("users").upsert({"id": _sub_to_uuid(user_id), "email": email}, on_conflict="id").execute()


def record_skip_decision(user_id: str, asin: str, co2_kg: float) -> None:
    """Record a skip decision and credit CO₂ savings to the user."""
    if co2_kg <= 0:
        return
    db = _client()
    uid = _sub_to_uuid(user_id)
    try:
        db.table("decisions").upsert({
            "user_id": uid,
            "asin": asin,
            "decision": "skip",
            "co2_avoided_kg": co2_kg,
        }, on_conflict="user_id,asin").execute()
        db.rpc("record_co2_saved", {"p_user_id": uid, "p_co2_kg": co2_kg}).execute()
    except Exception:
        pass


def get_global_impact() -> dict:
    """Return aggregate CO₂ savings across all users for the community counter."""
    db = _client()
    try:
        result = db.table("users").select("total_co2_saved_kg").execute()
        total_co2 = sum(float(r.get("total_co2_saved_kg") or 0) for r in (result.data or []))
        user_count = len(result.data or [])
        return {"total_co2_kg": round(total_co2, 1), "total_users": user_count}
    except Exception:
        return {"total_co2_kg": 0.0, "total_users": 0}


def log_agent_action(
    agent_name: str,
    auth0_client_id: str,
    asin: str,
    action: str,
    input_payload: str,
    output_payload: str,
    latency_ms: int,
) -> None:
    db = _client()
    db.table("agent_audit_log").insert({
        "agent_name": agent_name,
        "auth0_client_id": auth0_client_id,
        "asin": asin,
        "action": action,
        "input_hash": hashlib.sha256(input_payload.encode()).hexdigest(),
        "output_hash": hashlib.sha256(output_payload.encode()).hexdigest(),
        "latency_ms": latency_ms,
    }).execute()
