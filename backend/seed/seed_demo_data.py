"""
Seed demo data for EcoLens hackathon demo.
Run from backend/ directory:
    python seed/seed_demo_data.py
"""
import sys
import os
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Load .env.local from project root
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env.local")

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    sys.exit(1)

db = create_client(SUPABASE_URL, SUPABASE_KEY)

DEMO_USER_ID    = "00000000-0000-0000-0000-000000000001"
DEMO_USER_EMAIL = "demo@ecolens.app"

# 10 demo products with realistic scores
DEMO_PRODUCTS = [
    {
        "asin": "B00PKJT5LU",
        "title": "Seventh Generation Free & Clear Dish Liquid",
        "score": 84,
        "leaf_rating": 4,
        "confidence": "High",
        "climate_pledge_friendly": True,
        "co2_kg": 0.8,
        "explanation": "Seventh Generation uses plant-based ingredients and has held EPA Safer Choice certification since 2011. Their manufacturing uses 100% renewable energy, significantly reducing carbon impact.",
        "data_sources": ["EPA Safer Choice", "B Corp Directory", "GoodOnYou", "Seventh Generation sustainability report"],
        "dimensions": {
            "carbon": 80,
            "packaging": 85,
            "brand_ethics": 90,
            "certifications": 95,
            "durability": 70,
        },
        "alternatives": [
            {"asin": "B004GHNKBK", "title": "Mrs. Meyer's Clean Day Dish Soap", "score": 78, "reason": "Plant-based, B Corp certified", "image_url": "", "price_delta": -1.50},
        ],
    },
    {
        "asin": "B07YFGJR4W",
        "title": "Allbirds Men's Tree Runner Sneakers",
        "score": 88,
        "leaf_rating": 5,
        "confidence": "High",
        "climate_pledge_friendly": True,
        "co2_kg": 0.6,
        "explanation": "Allbirds Tree Runners are made from eucalyptus tree fiber (TENCEL Lyocell) and recycled materials. Carbon footprint is 7.68 kg CO₂e per pair — below industry average of 13.6 kg CO₂e.",
        "data_sources": ["Allbirds carbon footprint label", "GoodOnYou", "B Corp Directory", "FSC certification"],
        "dimensions": {
            "carbon": 88,
            "packaging": 85,
            "brand_ethics": 92,
            "certifications": 90,
            "durability": 82,
        },
        "alternatives": [],
    },
    {
        "asin": "B004GHNKBK",
        "title": "Mrs. Meyer's Clean Day Multi-Surface Everyday Cleaner",
        "score": 71,
        "leaf_rating": 4,
        "confidence": "High",
        "climate_pledge_friendly": False,
        "co2_kg": 0.5,
        "explanation": "Mrs. Meyer's uses plant-derived cleaning agents and recyclable packaging. B Corp certified since 2014. Some synthetic fragrances remain a concern, keeping the score below 80.",
        "data_sources": ["B Corp Directory", "EPA Safer Choice partial", "GoodOnYou", "Mrs. Meyer's ingredient list"],
        "dimensions": {
            "carbon": 70,
            "packaging": 75,
            "brand_ethics": 78,
            "certifications": 72,
            "durability": 65,
        },
        "alternatives": [
            {"asin": "B00PKJT5LU", "title": "Seventh Generation Free & Clear Dish Liquid", "score": 84, "reason": "EPA Safer Choice + B Corp, no synthetic fragrance", "image_url": "", "price_delta": 0.50},
        ],
    },
    {
        "asin": "B07SWKQZJ7",
        "title": "Nalgene Sustain Tritan BPA-Free Water Bottle 32 oz",
        "score": 77,
        "leaf_rating": 4,
        "confidence": "High",
        "climate_pledge_friendly": True,
        "co2_kg": 0.3,
        "explanation": "Nalgene Sustain is made from 50% Eastman Tritan Renew, recycled from plastic waste. Bottles last 10+ years, dramatically reducing lifetime footprint vs single-use plastic.",
        "data_sources": ["Nalgene sustainability page", "Eastman Tritan Renew certification", "EPA product data"],
        "dimensions": {
            "carbon": 75,
            "packaging": 82,
            "brand_ethics": 70,
            "certifications": 78,
            "durability": 95,
        },
        "alternatives": [],
    },
    {
        "asin": "B08KTZ8249",
        "title": "Kindle Paperwhite (16 GB) — Now with 3 months free Kindle Unlimited",
        "score": 56,
        "leaf_rating": 3,
        "confidence": "Medium",
        "climate_pledge_friendly": False,
        "co2_kg": 2.1,
        "explanation": "Amazon's Kindle devices use recycled plastics in packaging and manufacturing, but e-waste concerns and electronics manufacturing emissions keep the score in the average range.",
        "data_sources": ["Amazon sustainability report 2023", "EPA electronics guidelines", "iFixit repairability score"],
        "dimensions": {
            "carbon": 50,
            "packaging": 65,
            "brand_ethics": 55,
            "certifications": 45,
            "durability": 68,
        },
        "alternatives": [],
    },
    {
        "asin": "B000EQUMXM",
        "title": "Coleman Classic Propane Camp Stove, 2 Burners",
        "score": 29,
        "leaf_rating": 2,
        "confidence": "Medium",
        "climate_pledge_friendly": False,
        "co2_kg": 4.2,
        "explanation": "Propane camp stoves produce direct CO₂ emissions during use. Manufacturing uses energy-intensive metals with no reported recycled content. Packaging is non-recyclable mixed plastic.",
        "data_sources": ["EPA emissions data", "Coleman product specs", "Manufacturing carbon benchmarks"],
        "dimensions": {
            "carbon": 22,
            "packaging": 28,
            "brand_ethics": 35,
            "certifications": 18,
            "durability": 60,
        },
        "alternatives": [
            {"asin": "B07SWKQZJ7", "title": "BioLite CampStove 2+ (wood-burning, charges devices)", "score": 64, "reason": "Burns renewable biomass, zero propane, generates electricity", "image_url": "", "price_delta": 50.0},
        ],
    },
    {
        "asin": "B0CXYZ1234",
        "title": "Patagonia Better Sweater Fleece Jacket",
        "score": 79,
        "leaf_rating": 4,
        "confidence": "High",
        "climate_pledge_friendly": True,
        "co2_kg": 0.4,
        "explanation": "Patagonia's Better Sweater uses 100% recycled polyester fleece with Fair Trade Certified sewing. Patagonia is a B Corp and donates 1% of sales to environmental causes.",
        "data_sources": ["GoodOnYou (5/5 rating)", "B Corp Directory", "Fair Trade Certified", "Patagonia environmental report"],
        "dimensions": {
            "carbon": 78,
            "packaging": 80,
            "brand_ethics": 92,
            "certifications": 85,
            "durability": 88,
        },
        "alternatives": [],
    },
    {
        "asin": "B00MNV8E0C",
        "title": "Amazon Basics AA Performance Alkaline Batteries (48 Count)",
        "score": 22,
        "leaf_rating": 1,
        "confidence": "High",
        "climate_pledge_friendly": False,
        "co2_kg": 3.8,
        "explanation": "Single-use alkaline batteries have high lifecycle CO₂ and generate hazardous waste. No recycled content or take-back program. Rechargeable alternatives offer 100x lower lifetime impact.",
        "data_sources": ["EPA batteries lifecycle analysis", "GoodOnYou", "Battery University lifecycle data"],
        "dimensions": {
            "carbon": 18,
            "packaging": 30,
            "brand_ethics": 28,
            "certifications": 10,
            "durability": 20,
        },
        "alternatives": [
            {"asin": "B00JHKSXUY", "title": "Panasonic Eneloop Pro AA Rechargeable Batteries (8 pack + charger)", "score": 72, "reason": "Rechargeable — 500 charge cycles vs single-use, 100x lower lifetime CO₂", "image_url": "", "price_delta": 15.0},
        ],
    },
    {
        "asin": "B07XXXFAST",
        "title": "Generic Fast Fashion Men's T-Shirt (3-Pack)",
        "score": 16,
        "leaf_rating": 1,
        "confidence": "High",
        "climate_pledge_friendly": False,
        "co2_kg": 5.5,
        "explanation": "Fast fashion items from unidentified brands typically use virgin polyester or cotton grown with pesticides, manufactured in countries with no verified labor standards, shipped from Asia with no carbon offsetting.",
        "data_sources": ["GoodOnYou (1/5 rating)", "Textile industry CO₂ benchmarks", "Stand.earth fast fashion report"],
        "dimensions": {
            "carbon": 12,
            "packaging": 20,
            "brand_ethics": 10,
            "certifications": 5,
            "durability": 25,
        },
        "alternatives": [
            {"asin": "B0CXYZ1234", "title": "Patagonia Capilene Cool Daily T-Shirt", "score": 76, "reason": "Fair Trade, recycled materials, repaired not replaced", "image_url": "", "price_delta": 25.0},
        ],
    },
    {
        "asin": "B07PQHG1V3",
        "title": "Rubbermaid TakeAlongs Food Storage Containers, 40-piece set",
        "score": 31,
        "leaf_rating": 2,
        "confidence": "Medium",
        "climate_pledge_friendly": False,
        "co2_kg": 2.9,
        "explanation": "Plastic food storage containers use virgin polypropylene with no recycled content. Durability is low — most units are discarded within 2 years, creating significant plastic waste.",
        "data_sources": ["EPA plastics lifecycle data", "Product reviews (avg durability rating 2.8/5)", "Manufacturing benchmarks"],
        "dimensions": {
            "carbon": 28,
            "packaging": 35,
            "brand_ethics": 30,
            "certifications": 15,
            "durability": 35,
        },
        "alternatives": [
            {"asin": "B001B4MKP0", "title": "Pyrex Simply Store Glass Food Storage Containers (18-pc set)", "score": 68, "reason": "Borosilicate glass, dishwasher safe, 10+ year lifespan", "image_url": "", "price_delta": 8.0},
        ],
    },
]


def upsert_demo_user():
    """Ensure demo user exists in users table."""
    print(f"Upserting demo user {DEMO_USER_EMAIL}...")
    db.table("users").upsert({
        "id": DEMO_USER_ID,
        "email": DEMO_USER_EMAIL,
        "total_co2_saved_kg": 12.3,
        "scan_streak": 7,
    }, on_conflict="id").execute()
    print("  ✓ Demo user upserted")


def seed_scores_cache():
    """Insert all 10 demo products into scores_cache."""
    print("\nSeeding scores_cache...")
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()

    for p in DEMO_PRODUCTS:
        db.table("scores_cache").upsert({
            "asin": p["asin"],
            "score": p["score"],
            "leaf_rating": p["leaf_rating"],
            "confidence": p["confidence"],
            "climate_pledge_friendly": p["climate_pledge_friendly"],
            "explanation": p["explanation"],
            "data_sources": p["data_sources"],
            "dimensions": p["dimensions"],
            "alternatives": p["alternatives"],
            "voice_audio_url": None,
            "expires_at": expires_at,
        }, on_conflict="asin").execute()
        print(f"  ✓ {p['asin']} — {p['title'][:50]} (score: {p['score']})")


def seed_scan_history():
    """Insert 30 scan history entries for demo user spread over last 30 days."""
    print("\nSeeding scan history...")
    db.table("scans").delete().eq("user_id", DEMO_USER_ID).execute()

    entries = []
    now = datetime.now(timezone.utc)

    # Build a pool: repeat products to get 30 entries
    pool = DEMO_PRODUCTS * 4  # 40 entries, take 30
    random.seed(42)
    random.shuffle(pool)
    pool = pool[:30]

    for i, p in enumerate(pool):
        days_ago = i  # 1 entry per day for last 30 days
        scan_time = now - timedelta(days=days_ago, hours=random.randint(0, 14))
        entries.append({
            "user_id": DEMO_USER_ID,
            "asin": p["asin"],
            "product_title": p["title"],
            "score": p["score"],
            "co2_saved_kg": p["co2_kg"] if p["score"] >= 60 else 0,
            "scanned_at": scan_time.isoformat(),
        })

    db.table("scans").insert(entries).execute()
    print(f"  ✓ Inserted {len(entries)} scan history entries")

    # Update actual CO2 total from scan history
    total_co2 = sum(e["co2_saved_kg"] for e in entries)
    db.table("users").update({"total_co2_saved_kg": round(total_co2, 2)}).eq("id", DEMO_USER_ID).execute()
    print(f"  ✓ Updated demo user total_co2_saved_kg = {round(total_co2, 2)}")


def seed_voice_audio():
    """Pre-generate ElevenLabs audio for all 10 demo products."""
    from elevenlabs.client import ElevenLabs

    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "")

    if not elevenlabs_key or not voice_id:
        print("\nSkipping voice audio (ELEVENLABS_API_KEY not set)")
        return

    client = ElevenLabs(api_key=elevenlabs_key)
    voice_template = "{title} scores {score} out of 100 on EcoLens — that's {leaf_rating} out of 5 leaves. {explanation} {alternative_hint} Want to make a greener choice today?"

    print("\nPre-generating ElevenLabs audio...")
    for p in DEMO_PRODUCTS:
        # Check if already cached
        row = db.table("scores_cache").select("voice_audio_url").eq("asin", p["asin"]).single().execute()
        if row.data and row.data.get("voice_audio_url"):
            print(f"  ↩ {p['asin']} — already cached, skipping")
            continue

        alt_hint = ""
        if p["alternatives"]:
            alt_hint = f"A greener option is {p['alternatives'][0]['title']}."

        text = voice_template.format(
            title=p["title"],
            score=p["score"],
            leaf_rating=p["leaf_rating"],
            explanation=p["explanation"],
            alternative_hint=alt_hint,
        ).strip()

        try:
            audio_iter = client.text_to_speech.convert(
                voice_id=voice_id,
                text=text,
                model_id="eleven_turbo_v2",
                output_format="mp3_44100_128",
            )
            audio_bytes = b"".join(audio_iter)

            storage_path = f"{p['asin']}.mp3"
            db.storage.from_("voice-cache").upload(
                path=storage_path,
                file=audio_bytes,
                file_options={"content-type": "audio/mpeg", "upsert": "true"},
            )
            public_url = db.storage.from_("voice-cache").get_public_url(storage_path)
            db.table("scores_cache").update({"voice_audio_url": public_url}).eq("asin", p["asin"]).execute()
            print(f"  ✓ {p['asin']} — audio uploaded ({len(audio_bytes):,} bytes)")

        except Exception as e:
            print(f"  ✗ {p['asin']} — failed: {e}")


def verify():
    """Print summary of seeded data."""
    print("\n--- Verification ---")
    user = db.table("users").select("*").eq("id", DEMO_USER_ID).single().execute()
    scans = db.table("scans").select("id", count="exact").eq("user_id", DEMO_USER_ID).execute()
    cache = db.table("scores_cache").select("asin, score, voice_audio_url", count="exact").execute()

    print(f"User: {user.data['email']} | CO₂: {user.data['total_co2_saved_kg']} kg | Streak: {user.data['scan_streak']} days")
    print(f"Scans: {scans.count} entries")
    print(f"Scores cache: {cache.count} ASINs")
    print("\nCached products:")
    for row in cache.data:
        voice = "🔊" if row.get("voice_audio_url") else "  "
        print(f"  {voice} {row['asin']} → score {row['score']}")


if __name__ == "__main__":
    print("=== EcoLens Seed Script ===\n")
    upsert_demo_user()
    seed_scores_cache()
    seed_scan_history()
    seed_voice_audio()
    verify()
    print("\n✅ Seed complete!")
