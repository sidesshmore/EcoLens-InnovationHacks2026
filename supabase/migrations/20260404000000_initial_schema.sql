-- ============================================================
--  EcoLens — Initial Schema Migration
--  Run in: Supabase Dashboard → SQL Editor → New Query
--  Or: supabase db push (if using Supabase CLI)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tables ───────────────────────────────────────────────────────────────────

-- Users (Auth0 manages auth; this mirrors profile + aggregated stats)
create table if not exists public.users (
  id                  uuid        primary key,  -- Auth0 'sub' (e.g. google-oauth2|123)
  email               text        unique,
  created_at          timestamptz not null default now(),
  total_co2_saved_kg  numeric     not null default 0,
  scan_streak         int         not null default 0,
  last_scan_date      date
);

-- Score cache (shared across all users, keyed by ASIN, 24h TTL)
create table if not exists public.scores_cache (
  asin                    text        primary key,
  score                   int         not null check (score between 0 and 100),
  leaf_rating             int         not null check (leaf_rating between 1 and 5),
  dimensions              jsonb       not null default '{}'::jsonb,
  -- dimensions shape: { carbon, packaging, brand_ethics, certifications, durability }
  climate_pledge_friendly boolean     not null default false,
  explanation             text,
  confidence              text        not null default 'Low' check (confidence in ('High','Medium','Low')),
  data_sources            jsonb       not null default '[]'::jsonb,
  -- data_sources shape: ["Open Food Facts", "GoodOnYou", "Gemini Research", "Climate Pledge Badge"]
  alternatives            jsonb       not null default '[]'::jsonb,
  -- alternatives shape: [{ asin, title, score, price_delta, reason, image_url }]
  voice_audio_url         text,       -- Supabase Storage URL, populated on first "Listen" click
  scored_at               timestamptz not null default now(),
  expires_at              timestamptz not null default (now() + interval '24 hours')
);

-- Per-user scan history
create table if not exists public.scans (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references public.users(id) on delete cascade,
  asin            text        not null references public.scores_cache(asin),
  product_title   text        not null,
  score           int         not null check (score between 0 and 100),
  co2_saved_kg    numeric     not null default 0,  -- populated when user made a green swap
  scanned_at      timestamptz not null default now()
);

-- AI agent audit log (Auth0 AI Agents compliance — every LLM call is recorded)
create table if not exists public.agent_audit_log (
  id              uuid        primary key default uuid_generate_v4(),
  agent_name      text        not null,  -- 'gemini_research' | 'score_aggregator' | 'recommendation_engine' | 'voice_narrator'
  auth0_client_id text,                  -- M2M client_id that made the call
  asin            text,
  action          text        not null,  -- 'score' | 'voice' | 'recommend' | 'cart_scan'
  input_hash      text,                  -- sha256 of input payload (no PII stored)
  output_hash     text,                  -- sha256 of output payload
  latency_ms      int,
  called_at       timestamptz not null default now()
);

-- User feedback on scores (human-in-the-loop)
create table if not exists public.feedback (
  id                  uuid        primary key default uuid_generate_v4(),
  user_id             uuid        references public.users(id) on delete set null,
  asin                text        not null,
  reported_score      int         check (reported_score between 0 and 100),
  suggested_correction text,
  created_at          timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Cache expiry: fast lookup for expired entries (for cleanup jobs)
create index if not exists idx_scores_cache_expires_at
  on public.scores_cache(expires_at);

-- Dashboard: user's scan history ordered by recency
create index if not exists idx_scans_user_recent
  on public.scans(user_id, scanned_at desc);

-- Audit log: look up all calls for a given ASIN
create index if not exists idx_audit_asin
  on public.agent_audit_log(asin);

-- Audit log: look up all calls by a given agent
create index if not exists idx_audit_agent_name
  on public.agent_audit_log(agent_name, called_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.users             enable row level security;
alter table public.scans             enable row level security;
alter table public.feedback          enable row level security;
alter table public.scores_cache      enable row level security;
alter table public.agent_audit_log   enable row level security;

-- scores_cache: readable by everyone (it's product data, not personal)
create policy "scores_cache: public read"
  on public.scores_cache for select
  using (true);

-- scores_cache: only service role can insert/update (backend only)
create policy "scores_cache: service role write"
  on public.scores_cache for all
  using (auth.role() = 'service_role');

-- users: each user reads/updates only their own row
create policy "users: own row read"
  on public.users for select
  using (auth.uid()::text = id::text);

create policy "users: own row update"
  on public.users for update
  using (auth.uid()::text = id::text);

-- users: service role can do anything (backend upserts on login)
create policy "users: service role all"
  on public.users for all
  using (auth.role() = 'service_role');

-- scans: users read only their own scans
create policy "scans: own rows read"
  on public.scans for select
  using (auth.uid()::text = user_id::text);

-- scans: service role inserts (backend writes after each score)
create policy "scans: service role write"
  on public.scans for all
  using (auth.role() = 'service_role');

-- feedback: users can insert + read their own
create policy "feedback: own rows"
  on public.feedback for all
  using (auth.uid()::text = user_id::text);

create policy "feedback: service role all"
  on public.feedback for all
  using (auth.role() = 'service_role');

-- agent_audit_log: service role only (never exposed to users)
create policy "audit_log: service role only"
  on public.agent_audit_log for all
  using (auth.role() = 'service_role');

-- ── Helper Functions ─────────────────────────────────────────────────────────

-- Called by backend after a green swap is recorded
-- Increments total_co2_saved_kg and updates streak
create or replace function public.record_co2_saved(
  p_user_id       uuid,
  p_co2_kg        numeric,
  p_scan_date     date default current_date
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.users (id, total_co2_saved_kg, scan_streak, last_scan_date)
  values (p_user_id, p_co2_kg, 1, p_scan_date)
  on conflict (id) do update set
    total_co2_saved_kg = public.users.total_co2_saved_kg + excluded.total_co2_saved_kg,
    scan_streak = case
      when public.users.last_scan_date = p_scan_date - 1 then public.users.scan_streak + 1
      when public.users.last_scan_date = p_scan_date     then public.users.scan_streak  -- same day, no change
      else 1                                                                              -- streak broken
    end,
    last_scan_date = p_scan_date;
end;
$$;

-- Cleans up expired cache entries (run as a scheduled job or before scoring)
create or replace function public.purge_expired_scores()
returns int
language plpgsql
security definer
as $$
declare
  deleted_count int;
begin
  delete from public.scores_cache
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- ── Storage Bucket ───────────────────────────────────────────────────────────
-- NOTE: Run this separately in the Supabase Dashboard → Storage
-- OR via the Supabase JS/Python client with service role key.
--
-- dashboard.storage.createBucket('voice-cache', { public: true })
--
-- SQL equivalent (requires pg_storage extension — available in Supabase):
insert into storage.buckets (id, name, public)
values ('voice-cache', 'voice-cache', true)
on conflict (id) do nothing;

-- Allow public reads on voice-cache bucket
create policy "voice-cache: public read"
  on storage.objects for select
  using (bucket_id = 'voice-cache');

-- Allow service role to upload audio files
create policy "voice-cache: service role upload"
  on storage.objects for insert
  with check (bucket_id = 'voice-cache' and auth.role() = 'service_role');

-- ── Seed: Demo User ──────────────────────────────────────────────────────────
-- Insert a demo user for judging day
-- Replace the UUID with the actual Auth0 sub after first login,
-- or use this fixed UUID and log in with the demo account.
insert into public.users (id, email, total_co2_saved_kg, scan_streak, last_scan_date)
values (
  '00000000-0000-0000-0000-000000000001',
  'demo@ecolens.app',
  12.3,
  7,
  current_date
)
on conflict (id) do nothing;
