# EcoLens

**Know what you're really buying.**

EcoLens is a Chrome extension that silently activates on Amazon product pages and gives you an AI-generated sustainability score in under 5 seconds — carbon footprint, packaging waste, brand ethics, certifications — before you decide to buy. A companion web dashboard tracks your cumulative impact over time.

---

## The Problem

Amazon processes over 1.6 billion purchases every year. The average household's online shopping habit generates roughly 1.2 tonnes of CO₂ annually — and nearly all of that happens without the buyer ever knowing.

It's not that people don't care. In survey after survey, 70–80% of consumers say they want to shop more sustainably. The problem is that at the moment of decision — the second your cursor is over "Add to Cart" — you have zero environmental information. Amazon shows you price, star ratings, and delivery speed. It tells you nothing about where the product was made, how it was packaged, what the brand's environmental record looks like, or what a greener alternative might cost.

Sustainable consumption, at scale, is an information problem. We built EcoLens to solve it at the point of purchase — where it actually matters.

---

## What EcoLens Does

When you land on an Amazon product page, EcoLens:

1. **Extracts product data from the DOM** — title, brand, ASIN, category, materials, origin, and any existing Amazon certifications (like Climate Pledge Friendly)
2. **Runs a parallel multi-agent AI pipeline** via a FastAPI backend — three agents (ProductParser, DatabaseLookup, GeminiResearch) fire simultaneously, then ScoreAggregator synthesizes a final 0–100 score across five dimensions
3. **Overlays a non-intrusive score card** on the page — leaf rating (1–5 🍃), dimension breakdown, confidence level, and 2–3 greener alternatives
4. **Reads your cart** — a "Scan My Cart" banner on checkout surfaces the aggregate CO₂ footprint and flags the worst offender
5. **Narrates on demand** — hit "Listen" and ElevenLabs reads a 20-second sustainability briefing in natural speech
6. **Tracks your impact** — a Next.js dashboard shows cumulative CO₂ avoided, scan history with scores, and your sustainability streak

The full loop: **awareness → decision capture → purchase friction → reflection → habit.**

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Chrome browser
- A Supabase project
- Auth0 application (regular web app) + a Machine-to-Machine application
- API keys for Gemini, ElevenLabs, and SerpAPI

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env.local
```

---

### 1. Supabase — database setup

Run the migrations in order against your Supabase project:

```bash
# Apply via Supabase CLI
supabase db push

# Or paste directly into the SQL editor in the Supabase dashboard:
#   supabase/migrations/20260404000000_initial_schema.sql
#   supabase/migrations/20260404000001_decisions_table.sql
```

To pre-populate with demo scan history:

```bash
cd backend
python seed/seed_demo_data.py
```

---

### 2. Backend — FastAPI

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

---

### 3. Chrome Extension

```bash
cd extension
npm install
npm run dev          # development build with hot reload
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/build/chrome-mv3-dev` folder
4. Navigate to any Amazon product page

For a production build:

```bash
npm run build        # outputs to extension/build/chrome-mv3-prod
```

---

### 4. Dashboard — Next.js

```bash
cd dashboard
npm install
npm run dev          # starts at http://localhost:3000
```

The dashboard requires Auth0 login. Set `AUTH0_BASE_URL=http://localhost:3000` in your `.env.local`.

---

## Architecture

All AI calls follow a single path: **Extension DOM → FastAPI Orchestrator → Parallel Agents → Supabase Cache → Extension UI.**

```
User browses amazon.com/dp/...
            │
            ▼
  [Chrome Extension — Content Script]
    Extracts: title · brand · ASIN · category · materials · origin
            │
            ▼  POST /api/score  (Auth0 JWT)
  [FastAPI Orchestrator]  ←── Auth0 M2M token (agent identity)
            │
     ┌──────┼──────┐
     ▼      ▼      ▼   (parallel, async)
[ProductParser] [DatabaseLookup] [GeminiResearch]
  Normalise DOM   Open Food Facts   Gemini 2.0 Flash
  → Pydantic schema  GoodOnYou       + Google Search grounding
     └──────┬──────┘         │
            ▼                ▼
      [ScoreAggregator]  ─────┘
       Weighted 0–100 · leaf rating · CO₂ estimate · explanation
            │
            ▼
      [RecommendationEngine]
       SERP search · re-score top candidates · 2–3 greener swaps
            │
            ▼
      Cached in Supabase (ASIN key · 24h TTL)
            │
            ▼  JSON → Extension renders ScoreCard
            │
            ▼  on "Listen" click
      [ElevenLabs VoiceNarrator]
       summary text → audio stream → cached per ASIN
```

### Scoring dimensions

| Dimension | Weight | Data sources |
|---|---|---|
| Carbon Footprint | 30% | Gemini research + EPA eGRID + material analysis |
| Brand Ethics | 25% | GoodOnYou index + Gemini web research |
| Packaging | 20% | Review sentiment + product listing + Gemini |
| Certifications | 15% | DOM scrape (Climate Pledge Friendly, organic, etc.) |
| Durability | 10% | Category norms + review analysis |

Scores are cached per ASIN for 24 hours. Cache hit = <100ms response at $0 cost.

---

## Features

### Chrome Extension

**Product Score Card**  
Activates on any `amazon.com/dp/*` page. Floating, dismissable card showing: overall score, leaf rating, dimension sub-scores, confidence level, 2-sentence explanation, and 2–3 greener alternatives with price delta.

**Search Result Badges**  
Injects a coloured leaf badge (🍃 + score) next to each product card on Amazon search results pages. Cached scores appear instantly. Makes sustainability visible before a product page is even opened.

**Cart Scanner**  
On `amazon.com/cart`, a "Scan My Cart" banner scores every item in your cart, surfaces the aggregate CO₂ estimate, flags the worst offender, and suggests greener swaps.

**Skip / Buy Decision Capture**  
The score card footer shows a "Skip · save ~X.X kg CO₂" action for low-scoring products. Choices are recorded — both locally and in Supabase for authenticated users — making impact trackable and real.

**Add-to-Cart Friction ("Slow Cart")**  
For products scoring below 50, EcoLens intercepts the "Add to Cart" click with a 3-second pause moment: the product's CO₂ cost, its worst dimension, and a greener alternative. The friction happens at the highest-leverage point in the purchase funnel.

**Order History Audit**  
Content script on `amazon.com/gp/your-account/order-history` batch-scores past orders and shows total CO₂ emitted from recent purchases — a "mirror moment" for behaviour reflection.

**ElevenLabs Voice Briefing**  
On-demand only, never autoplayed. Hitting "Listen" calls ElevenLabs to narrate a concise sustainability summary in natural, expressive speech. Audio is cached per ASIN so repeat listens are instant and free.

### Web Dashboard

**Scan History Table**  
Full history of every scanned product with score, verdict (BUY / PAUSE / SKIP), CO₂ impact, and date. Sortable and filterable. Click any row for the full dimension breakdown, AI explanation, and greener alternatives.

**Community Stats**  
Landing page shows aggregate CO₂ avoided across all EcoLens users — updated live. Social proof that turns individual action into collective momentum.

**Accessibility Panel**  
A built-in accessibility FAB supports large text, high contrast, dark mode, reduced motion, and three colour-vision modes (deuteranopia, protanopia, tritanopia). Settings persist across sessions.

---

## Technology

### Google Gemini 2.0 Flash
The backbone of the scoring pipeline. Three separate agent calls are made per fresh product scan: GeminiResearch uses **Google Search grounding** to find up-to-date certifications, brand controversies, and sustainability reports in real time. ScoreAggregator uses Gemini's reasoning capability to synthesise a structured score with a plain-English explanation. RecommendationEngine uses Gemini to evaluate and rank greener alternatives. Three separate API keys are rotated across agents to stay comfortably within free-tier rate limits during the demo.

### ElevenLabs
Voice narration is generated on demand via the ElevenLabs `/v1/text-to-speech` endpoint. The system prompt instructs a warm, conversational tone — not robotic bullet points but a genuine spoken summary ("This product scores 72 out of 100. The main issue is packaging — reviewers consistently mention excessive plastic wrap..."). Audio is stored in Supabase Storage and keyed by ASIN, so each product is only synthesised once.

### Auth0
**User authentication:** Google SSO and email/password login. JWTs are validated on every API call. Unauthenticated users get 3 free scans per day (rate-limited by IP); authenticated users are unlimited.

**Auth0 AI Agents (Machine-to-Machine):** The FastAPI orchestrator holds its own Auth0 M2M client credential with four scoped permissions: `read:products`, `invoke:llm`, `write:scores`, `invoke:voice`. Every AI agent call is signed with this token. Agent identity is entirely separate from user identity — the system demonstrates a clean human-in-the-loop pattern where AI acts on behalf of a user but under its own auditable credential. No AI operation happens without a verifiable, scoped token.

### Supabase
PostgreSQL for scan history, user profiles, score cache, and decision tracking. The `scores_cache` table is keyed by ASIN with a 24-hour TTL — cache hits return in under 100ms at zero API cost. Supabase Storage hosts cached ElevenLabs audio files. Row-level security ensures users only see their own data.

### Plasmo Framework
Chrome extension scaffolding with React + TypeScript, hot reload, and Manifest V3 compliance out of the box. Six content scripts cover the full Amazon surface area: product pages, search results, cart, checkout, and order history.

### Amazon Platform Integration
EcoLens works entirely from public Amazon DOM data — no partnership, no API, no scraping at scale. The Climate Pledge Friendly badge is read directly from the product page HTML and adds a +10 bonus to the score with a distinct callout. No Amazon credentials required.

---

## Impact at Scale

EcoLens works at the individual level — one informed decision at a time. But the model scales:

| Users | Decisions captured / month | Estimated CO₂ avoided / year |
|---|---|---|
| 1,000 | ~15,000 | ~43 tonnes |
| 100,000 | ~1.5M | ~4,320 tonnes |
| 1,000,000 | ~15M | ~43,200 tonnes |

43,200 tonnes of CO₂ is roughly equivalent to **removing 9,400 cars from the road for a year** — achievable with a free browser extension that requires no behaviour change beyond clicking "Skip."

The key insight is that CO₂ avoided from a skipped purchase is *real and attributable*. It's not an estimate from page views or session duration. It's a direct consequence of a captured decision. That makes the impact measurable in a way that most sustainability products are not.

---

## Repo Structure

```
├── backend/               # FastAPI — AI orchestration pipeline
│   ├── agents/            # ProductParser, GeminiResearch, ScoreAggregator, etc.
│   ├── auth/              # Auth0 JWT validation + M2M token management
│   ├── cache/             # Supabase score cache layer
│   ├── models/            # Pydantic schemas
│   ├── prompts/           # LLM system prompts (versioned as text files)
│   ├── voice/             # ElevenLabs integration
│   ├── seed/              # Demo data seeder
│   └── tests/             # Integration tests
├── extension/             # Plasmo Chrome extension
│   ├── src/
│   │   ├── contents/      # Content scripts (product, search, cart, orders)
│   │   ├── components/    # ScoreCard, ScoreBar, LeafRating
│   │   └── lib/           # API client, DOM extractor
│   └── assets/
├── dashboard/             # Next.js web dashboard
│   ├── src/app/           # App Router pages + layout
│   ├── src/components/    # ProductTable, AccessibilityFAB, impact components
│   └── src/lib/           # Auth0 client, Supabase client
└── supabase/
    └── migrations/        # SQL schema — apply in order
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
AUTH0_DOMAIN
AUTH0_CLIENT_ID / AUTH0_CLIENT_SECRET
AUTH0_M2M_CLIENT_ID / AUTH0_M2M_CLIENT_SECRET
GEMINI_API_KEY_1 / _2 / _3
ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID
SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
SERP_API_KEY
NEXT_PUBLIC_API_URL
```

Full descriptions and where to find each value are in `.env.example`.

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

---

*Built at Innovation Hacks 2026 in 23 hours.*
