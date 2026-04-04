"""
Gemini API key manager.

Each agent is assigned a dedicated key so free-tier quotas stay independent.
If the assigned key hits a 429, the manager falls back to the next available key
before raising an error.

Key delegation:
  KEY_1 → GeminiResearch      (most frequent — product sustainability research)
  KEY_2 → ScoreAggregator     (reasoning + explanation generation)
  KEY_3 → RecommendationEngine + VoiceNarrator text (least frequent)
"""

import os
import asyncio
from enum import Enum
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv(Path(__file__).parent.parent.parent / ".env.local")


GEMINI_MODEL = "gemini-2.5-flash"


class GeminiAgent(str, Enum):
    RESEARCH = "research"
    AGGREGATOR = "aggregator"
    RECOMMENDATION = "recommendation"
    VOICE = "voice"


# Each agent gets a dedicated primary key; fallback rotates through all 6
_AGENT_KEY_MAP: dict[GeminiAgent, str] = {
    GeminiAgent.RESEARCH:       "GEMINI_API_KEY_1",
    GeminiAgent.AGGREGATOR:     "GEMINI_API_KEY_2",
    GeminiAgent.RECOMMENDATION: "GEMINI_API_KEY_3",
    GeminiAgent.VOICE:          "GEMINI_API_KEY_3",
}

# Full rotation order — all 6 keys tried in sequence on 429
_FALLBACK_ORDER = [
    "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3",
    "GEMINI_API_KEY_4", "GEMINI_API_KEY_5", "GEMINI_API_KEY_6",
]


def _load_keys() -> dict[str, str]:
    keys = {}
    for env_var in _FALLBACK_ORDER:
        val = os.getenv(env_var)
        if val:
            keys[env_var] = val
    if not keys:
        raise RuntimeError(
            "No Gemini API keys found. Set GEMINI_API_KEY_1, _2, or _3 in .env.local"
        )
    return keys


def get_client(agent: GeminiAgent) -> genai.GenerativeModel:
    """
    Return a configured Gemini GenerativeModel for the given agent.
    Uses the agent's dedicated key; falls back to other keys on 429.
    """
    keys = _load_keys()
    primary_env = _AGENT_KEY_MAP[agent]

    # Try the dedicated key first, then fall back in order
    key_priority = [primary_env] + [k for k in _FALLBACK_ORDER if k != primary_env]

    for env_var in key_priority:
        key = keys.get(env_var)
        if key:
            genai.configure(api_key=key)
            return genai.GenerativeModel(
                model_name=GEMINI_MODEL,
                generation_config=genai.GenerationConfig(
                    temperature=0.2,        # low temp for factual scoring
                    response_mime_type="application/json",
                ),
            )

    raise RuntimeError("All Gemini API keys exhausted or missing.")


async def call_with_fallback(
    agent: GeminiAgent,
    prompt: str,
    system_instruction: Optional[str] = None,
    timeout_seconds: int = 6,
) -> str:
    """
    Call Gemini with automatic key fallback on rate limit (429).
    If all keys are rate-limited, waits up to 60 s and retries once before raising.
    Raises TimeoutError if no key responds within timeout_seconds.
    Raises RuntimeError if all keys are rate-limited after retry.
    """
    keys = _load_keys()
    primary_env = _AGENT_KEY_MAP[agent]
    key_priority = [primary_env] + [k for k in _FALLBACK_ORDER if k != primary_env]

    for attempt in range(2):  # try immediately, then retry once after a backoff
        last_error: Optional[Exception] = None

        for env_var in key_priority:
            key = keys.get(env_var)
            if not key:
                continue

            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel(
                    model_name=GEMINI_MODEL,
                    generation_config=genai.GenerationConfig(
                        temperature=0.2,
                        response_mime_type="application/json",
                    ),
                    system_instruction=system_instruction,
                )

                response = await asyncio.wait_for(
                    asyncio.to_thread(model.generate_content, prompt),
                    timeout=timeout_seconds,
                )
                return response.text

            except asyncio.TimeoutError:
                raise TimeoutError(
                    f"Gemini timed out after {timeout_seconds}s (agent: {agent}, key: {env_var})"
                )
            except Exception as e:
                # 429 Resource Exhausted → try next key
                if "429" in str(e) or "quota" in str(e).lower() or "exhausted" in str(e).lower():
                    last_error = e
                    continue
                raise  # non-rate-limit errors bubble up immediately

        # All keys rate-limited on this attempt
        if attempt == 0:
            # Back off 12 s and retry — free-tier windows reset frequently
            await asyncio.sleep(12)
        else:
            raise RuntimeError(
                f"All Gemini keys rate-limited for agent '{agent}'. Last error: {last_error}"
            )

    raise RuntimeError("Unreachable")
