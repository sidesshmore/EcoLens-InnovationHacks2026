-- ============================================================
--  EcoLens — Decisions Table
--  Records every skip/buy decision made by users in the extension.
--  Enables the behavior-change dashboard in the web UI.
--  Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create table if not exists public.decisions (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references public.users(id) on delete cascade,
  asin            text        not null,
  decision        text        not null check (decision in ('skip', 'buy')),
  co2_avoided_kg  numeric     not null default 0,
  created_at      timestamptz not null default now(),
  -- One row per user per ASIN — upserted on each new decision
  unique (user_id, asin)
);

-- Index for dashboard query (user's decisions, newest first)
create index if not exists idx_decisions_user_recent
  on public.decisions(user_id, created_at desc);

-- RLS
alter table public.decisions enable row level security;

create policy "decisions: own rows read"
  on public.decisions for select
  using (auth.uid()::text = user_id::text);

create policy "decisions: service role all"
  on public.decisions for all
  using (auth.role() = 'service_role');

-- Seed some demo decisions for the demo user (ID 00000000-0000-0000-0000-000000000001)
insert into public.decisions (user_id, asin, decision, co2_avoided_kg, created_at)
values
  ('00000000-0000-0000-0000-000000000001', 'B00MNV8E0C', 'skip', 0.84, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'B07XXXFAST', 'skip', 0.96, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'B07SWKQZJ7', 'buy',  0.00, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'B08KTZ8249', 'buy',  0.00, now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000001', 'B000EQUMXM', 'skip', 0.72, now() - interval '4 days'),
  ('00000000-0000-0000-0000-000000000001', 'B07PQHG1V3', 'skip', 0.78, now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000001', 'B004GHNKBK', 'buy',  0.00, now() - interval '6 days'),
  ('00000000-0000-0000-0000-000000000001', 'B07YFGJR4W', 'buy',  0.00, now() - interval '7 days')
on conflict (user_id, asin) do nothing;
