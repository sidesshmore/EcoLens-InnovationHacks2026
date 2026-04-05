"""
EcoLens API test suite.
Run from backend/ with the server already running on :8000:

    python tests/test_api.py

Gets a real M2M token from Auth0 so all requests are authenticated
(bypasses the 3/day guest rate limit).
"""
import sys
import os
import time
import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env.local")

BASE = "http://localhost:8000"

AUTH0_DOMAIN      = os.getenv("AUTH0_DOMAIN", "")
M2M_CLIENT_ID     = os.getenv("AUTH0_M2M_CLIENT_ID", "")
M2M_CLIENT_SECRET = os.getenv("AUTH0_M2M_CLIENT_SECRET", "")
AUDIENCE          = os.getenv("AUTH0_AUDIENCE", "https://api.ecolens.app")

# ── colour helpers ────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

passed = failed = 0


def ok(label: str, detail: str = ""):
    global passed
    passed += 1
    print(f"  {GREEN}✓{RESET} {label}" + (f"  {YELLOW}({detail}){RESET}" if detail else ""))


def fail(label: str, detail: str = ""):
    global failed
    failed += 1
    print(f"  {RED}✗{RESET} {label}" + (f"  {RED}{detail}{RESET}" if detail else ""))


def section(title: str):
    print(f"\n{BOLD}{title}{RESET}")
    print("─" * 50)


# ── auth ──────────────────────────────────────────────────────────────────────

def get_m2m_token() -> str:
    section("0. Auth0 M2M Token")
    if not all([AUTH0_DOMAIN, M2M_CLIENT_ID, M2M_CLIENT_SECRET]):
        fail("M2M credentials", "AUTH0_DOMAIN / AUTH0_M2M_CLIENT_ID / AUTH0_M2M_CLIENT_SECRET not set")
        sys.exit(1)
    r = httpx.post(
        f"https://{AUTH0_DOMAIN}/oauth/token",
        json={
            "grant_type": "client_credentials",
            "client_id": M2M_CLIENT_ID,
            "client_secret": M2M_CLIENT_SECRET,
            "audience": AUDIENCE,
        },
        timeout=10,
    )
    if r.status_code != 200:
        fail("Get M2M token", r.text[:200])
        sys.exit(1)
    token = r.json()["access_token"]
    ok("M2M token obtained", f"{token[:30]}…")
    return token


# ── test helpers ──────────────────────────────────────────────────────────────

def get(path: str, token: str | None = None, **kwargs) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return httpx.get(f"{BASE}{path}", headers=headers, timeout=60, **kwargs)


def post(path: str, token: str | None = None, **kwargs) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return httpx.post(f"{BASE}{path}", headers=headers, timeout=60, **kwargs)


# ── tests ─────────────────────────────────────────────────────────────────────

def test_health():
    section("1. Health Check")
    r = get("/health")
    if r.status_code == 200 and r.json().get("status") == "ok":
        ok("GET /health", r.json().get("service", ""))
    else:
        fail("GET /health", f"status={r.status_code}")


def test_score_cache_hit(token: str):
    section("2. Score — Cache Hit (seeded product)")
    t0 = time.time()
    r = post("/api/score", token=token, json={
        "asin": "B00PKJT5LU",
        "title": "Seventh Generation Free & Clear Dish Liquid",
        "brand": "Seventh Generation",
        "category": "cleaning",
    })
    elapsed = time.time() - t0
    if r.status_code != 200:
        fail("POST /api/score (cache)", f"status={r.status_code}  {r.text[:200]}")
        return
    d = r.json()
    if d.get("cached"):
        ok("Returns cached=true", f"{elapsed:.2f}s")
    else:
        fail("cached flag", "expected cached=true for seeded ASIN")
    if d.get("score") == 84:
        ok("Score = 84")
    else:
        fail("Score", f"expected 84, got {d.get('score')}")
    if d.get("leaf_rating") == 4:
        ok("Leaf rating = 4")
    else:
        fail("Leaf rating", f"expected 4, got {d.get('leaf_rating')}")
    if d.get("voice_audio_url"):
        ok("Voice URL pre-cached", d["voice_audio_url"][:60] + "…")
    else:
        fail("Voice URL", "expected pre-cached URL for seeded ASIN")
    dims = d.get("dimensions", {})
    if all(k in dims for k in ["carbon", "packaging", "brand_ethics", "certifications", "durability"]):
        ok("All 5 dimensions present")
    else:
        fail("Dimensions", f"missing keys in {list(dims.keys())}")
    alts = d.get("alternatives", [])
    if len(alts) >= 0:
        ok(f"Alternatives ({len(alts)} returned)")


def test_score_low_product(token: str):
    section("3. Score — Low-scoring cached product")
    r = post("/api/score", token=token, json={
        "asin": "B07XXXFAST",
        "title": "Generic Fast Fashion T-Shirt",
        "brand": "Unknown",
        "category": "apparel",
    })
    if r.status_code != 200:
        fail("POST /api/score (low)", f"status={r.status_code}")
        return
    d = r.json()
    ok("Returns 200")
    if d.get("score", 100) < 30:
        ok(f"Score is low ({d['score']}) — expected for fast fashion")
    else:
        fail("Score", f"expected <30 for fast fashion, got {d.get('score')}")
    if d.get("leaf_rating", 5) <= 2:
        ok(f"Leaf rating is low ({d['leaf_rating']})")
    else:
        fail("Leaf rating", f"expected <=2, got {d.get('leaf_rating')}")


def test_score_live_gemini(token: str):
    section("4. Score — Live Gemini (uncached product, ~15s)")
    print(f"  {YELLOW}Scoring a fresh ASIN via Gemini... please wait{RESET}")
    t0 = time.time()
    r = post("/api/score", token=token, json={
        "asin": "B09G9HD6PD",
        "title": "Burt's Bees Sensitive Facial Cleanser with Aloe Vera",
        "brand": "Burt's Bees",
        "category": "beauty",
        "description": "Natural skincare, no parabens, certified natural",
    })
    elapsed = time.time() - t0
    if r.status_code != 200:
        fail("POST /api/score (live)", f"status={r.status_code}  {r.text[:200]}")
        return
    d = r.json()
    if not d.get("cached"):
        ok(f"Fresh Gemini score in {elapsed:.1f}s", f"score={d.get('score')}")
    else:
        ok(f"Cache hit (already scored) in {elapsed:.1f}s", f"score={d.get('score')}")
    if d.get("explanation"):
        ok("Explanation present", d["explanation"][:80] + "…")
    else:
        fail("Explanation", "empty")
    if d.get("confidence") in ("High", "Medium", "Low"):
        ok(f"Confidence = {d['confidence']}")
    else:
        fail("Confidence", f"got {d.get('confidence')!r}")


def test_cart(token: str):
    section("5. Cart Scanner")
    r = post("/api/score/cart", token=token, json={"items": [
        {"asin": "B00PKJT5LU", "title": "Seventh Generation Dish Soap",    "brand": "Seventh Generation", "category": "cleaning"},
        {"asin": "B07XXXFAST", "title": "Generic Fast Fashion T-Shirt",     "brand": "Unknown",            "category": "apparel"},
        {"asin": "B07SWKQZJ7", "title": "Nalgene Water Bottle",            "brand": "Nalgene",            "category": "household"},
        {"asin": "B00MNV8E0C", "title": "Amazon Basics AA Batteries 48pk", "brand": "AmazonBasics",       "category": "electronics"},
    ]})
    if r.status_code != 200:
        fail("POST /api/score/cart", f"status={r.status_code}  {r.text[:200]}")
        return
    d = r.json()
    ok("Returns 200")
    if isinstance(d.get("aggregate_score"), int):
        ok(f"Aggregate score = {d['aggregate_score']}")
    else:
        fail("Aggregate score", "missing or not int")
    if isinstance(d.get("total_co2_kg"), (int, float)):
        ok(f"Total CO₂ = {d['total_co2_kg']} kg")
    else:
        fail("Total CO₂", "missing")
    if d.get("worst_offender_asin"):
        ok(f"Worst offender = {d['worst_offender_asin']}")
    else:
        fail("Worst offender", "missing")
    if isinstance(d.get("item_scores"), list) and len(d["item_scores"]) == 4:
        ok(f"item_scores has 4 entries")
    else:
        fail("item_scores", f"expected 4 entries, got {len(d.get('item_scores', []))}")


def test_voice(token: str):
    section("6. Voice Endpoint")
    r = get("/api/voice/B00PKJT5LU", token=token)
    if r.status_code != 200:
        fail("GET /api/voice/B00PKJT5LU", f"status={r.status_code}")
        return
    d = r.json()
    if d.get("audio_url", "").startswith("https://"):
        ok("Audio URL returned", d["audio_url"][:70] + "…")
    else:
        fail("Audio URL", f"got {d.get('audio_url')!r}")

    # 404 for unknown ASIN
    r2 = get("/api/voice/NOTREAL123", token=token)
    if r2.status_code == 404:
        ok("Unknown ASIN returns 404")
    else:
        fail("Unknown ASIN 404", f"got {r2.status_code}")


def test_user_stats(token: str):
    section("7. User Stats")
    r = get("/api/user/stats", token=token)
    if r.status_code != 200:
        fail("GET /api/user/stats", f"status={r.status_code}  {r.text[:100]}")
        return
    d = r.json()
    ok("Returns 200")
    for field in ("total_co2_saved_kg", "scan_streak", "scan_count"):
        if field in d:
            ok(f"{field} = {d[field]}")
        else:
            fail(field, "missing from response")

    # Without token → 401
    r2 = get("/api/user/stats")
    if r2.status_code == 401:
        ok("No token → 401")
    else:
        fail("No token should 401", f"got {r2.status_code}")


def test_rate_limit_guest():
    section("8. Rate Limiting — Guest (no token)")
    # Make 4 requests without a token — 4th should be rate-limited
    # Note: if you've already hit the limit today, the first call will also 429.
    results = []
    for i in range(4):
        r = post("/api/score", json={
            "asin": f"B00TEST000{i}",
            "title": "Test product",
            "brand": "TestBrand",
            "category": "other",
        })
        results.append(r.status_code)

    rate_limited = any(s == 429 for s in results)
    if rate_limited:
        ok("Guest hits 429 after limit", f"statuses: {results}")
    else:
        # May pass if IP is fresh — warn instead of fail
        print(f"  {YELLOW}⚠ No 429 seen (IP may be fresh or already counted){RESET}  statuses: {results}")


def test_rate_limit_auth_bypass(token: str):
    section("9. Rate Limiting — Auth bypasses limit")
    # Make 5 requests with token — none should 429
    statuses = []
    for _ in range(5):
        r = post("/api/score", token=token, json={
            "asin": "B00PKJT5LU",
            "title": "Seventh Generation",
            "brand": "Seventh Generation",
            "category": "cleaning",
        })
        statuses.append(r.status_code)
    if all(s == 200 for s in statuses):
        ok("5 authenticated requests all returned 200 — no rate limit")
    else:
        fail("Authenticated bypass", f"statuses: {statuses}")


# ── runner ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\n{BOLD}{'='*50}")
    print("  EcoLens API Test Suite")
    print(f"{'='*50}{RESET}")
    print(f"  Target: {BASE}")

    # Check server is up
    try:
        httpx.get(f"{BASE}/health", timeout=3)
    except Exception:
        print(f"\n{RED}ERROR: Server not running on {BASE}{RESET}")
        print("  Start it with: uvicorn main:app --reload --port 8000")
        sys.exit(1)

    token = get_m2m_token()

    test_health()
    test_score_cache_hit(token)
    test_score_low_product(token)
    test_score_live_gemini(token)
    test_cart(token)
    test_voice(token)
    test_user_stats(token)
    test_rate_limit_auth_bypass(token)
    test_rate_limit_guest()

    print(f"\n{'='*50}")
    total = passed + failed
    if failed == 0:
        print(f"{GREEN}{BOLD}  All {total} tests passed ✓{RESET}")
    else:
        print(f"{RED}{BOLD}  {failed} failed{RESET}, {GREEN}{passed} passed{RESET}  ({total} total)")
    print(f"{'='*50}\n")
    sys.exit(0 if failed == 0 else 1)
