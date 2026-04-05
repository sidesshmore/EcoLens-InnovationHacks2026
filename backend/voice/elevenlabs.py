import os
import time
from pathlib import Path
from elevenlabs.client import ElevenLabs
from supabase import create_client

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "voice_summary.txt"


def _supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _build_summary(title: str, brand: str, score: int, leaf_rating: int,
                   explanation: str, alternatives: list) -> str:
    template = PROMPT_PATH.read_text()
    alt_hint = ""
    if alternatives:
        alt_hint = f"A greener option is {alternatives[0].get('title', 'a certified alternative')}."
    return template.format(
        title=title, brand=brand, score=score,
        leaf_rating=leaf_rating, explanation=explanation,
        alternative_hint=alt_hint,
    ).strip()


async def get_or_generate_audio(
    asin: str,
    title: str,
    brand: str,
    score: int,
    leaf_rating: int,
    explanation: str,
    alternatives: list,
    cached_url: str | None = None,
) -> str | None:
    # Return cached URL if already generated
    if cached_url:
        return cached_url

    if not ELEVENLABS_API_KEY or not ELEVENLABS_VOICE_ID:
        return None

    summary_text = _build_summary(title, brand, score, leaf_rating, explanation, alternatives)

    try:
        client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        audio = client.text_to_speech.convert(
            voice_id=ELEVENLABS_VOICE_ID,
            text=summary_text,
            model_id="eleven_turbo_v2",
            output_format="mp3_44100_128",
        )
        audio_bytes = b"".join(audio)

        # Upload to Supabase Storage
        db = _supabase()
        storage_path = f"{asin}.mp3"
        db.storage.from_("voice-cache").upload(
            path=storage_path,
            file=audio_bytes,
            file_options={"content-type": "audio/mpeg", "upsert": "true"},
        )

        public_url = db.storage.from_("voice-cache").get_public_url(storage_path)

        # Update scores_cache with audio URL
        db.table("scores_cache").update({"voice_audio_url": public_url}).eq("asin", asin).execute()

        return public_url

    except Exception:
        return None  # fail silently — extension hides the Listen button
