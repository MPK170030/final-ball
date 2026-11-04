-- Final Ball: counter system (005)
-- Safe to re-run: all DDL uses IF NOT EXISTS / IF EXISTS guards.
-- Run in Supabase: Project → SQL Editor → New query.
-- Decisions: D17.4 (card-scoped counters), D17.5 (agent outcomes),
--            D17.6 (counter records), D17.7 (cap: 10/GW, failed don't count).

-- ── 1. counters ───────────────────────────────────────────────────────────────
-- One row per counter submission. status transitions: pending → ok | failed.
-- A failed or timed-out counter does not count toward the cap (D17.7).
-- quick_reply: the predefined reply the user chose (nullable; API copies its
--   text into message when the user adds no free-text).
-- message: required; API always populates it (from quick_reply, free text, or both).
-- outcome: set when status = 'ok'. declined = off-topic, no tool calls (D17.5).
-- new_payload: populated when outcome = 'changed_fact'; the revised card content.
create table if not exists public.counters (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  card_id      uuid        not null references public.cards(id) on delete cascade,
  gameweek     integer     not null,
  quick_reply  text,
  message      text        not null,
  outcome      text        check (outcome in ('held', 'changed_fact', 'accepted_preference', 'declined')),
  new_payload  jsonb,
  trace        jsonb,
  status       text        not null default 'pending'
                 check (status in ('pending', 'ok', 'failed')),
  created_at   timestamptz not null default now()
);

-- Primary access pattern: "all counters on this card"
create index if not exists counters_card_id_idx
  on public.counters (card_id);

alter table public.counters enable row level security;

drop policy if exists "Users read own counters"         on public.counters;
drop policy if exists "Service role can manage counters" on public.counters;

create policy "Users read own counters"
  on public.counters for select
  using (auth.uid() = user_id);

create policy "Service role can manage counters"
  on public.counters for all
  using (auth.role() = 'service_role');

-- ── 2. counter_records ────────────────────────────────────────────────────────
-- One record per settled counter (D17.6). Created by the daily job after the
-- receipt window closes. Scores "who was right when the user pushed back."
-- user_choice: what the user actually did (from FPL history after the deadline).
--   agent_original  = user followed the brief's original pick
--   agent_changed   = user followed the counter's revised pick
--   own             = user made a different move entirely
-- verdict: set when delta_pts is known (3 GWs after the transfer).
create table if not exists public.counter_records (
  counter_id   uuid        primary key references public.counters(id) on delete cascade,
  user_choice  text        check (user_choice in ('agent_original', 'agent_changed', 'own')),
  verdict      text        check (verdict in ('agent_right', 'user_right', 'even')),
  delta_pts    integer,
  status       text        not null default 'pending'
                 check (status in ('pending', 'settled')),
  settled_at   timestamptz
);

alter table public.counter_records enable row level security;

drop policy if exists "Users read own counter records"             on public.counter_records;
drop policy if exists "Service role can manage counter records"    on public.counter_records;

create policy "Users read own counter records"
  on public.counter_records for select
  using (
    exists (
      select 1 from public.counters
      where counters.id = counter_id
        and counters.user_id = auth.uid()
    )
  );

create policy "Service role can manage counter records"
  on public.counter_records for all
  using (auth.role() = 'service_role');

-- ── 3. counter_usage ─────────────────────────────────────────────────────────
-- Tracks the number of successful counters per user per gameweek (D17.7).
-- Only incremented when counters.status transitions to 'ok'.
-- Cap check: count < 10 before submitting. Starting value 10; tune after testing.
create table if not exists public.counter_usage (
  user_id  uuid    not null references public.profiles(id) on delete cascade,
  gameweek integer not null,
  count    integer not null default 0,
  primary key (user_id, gameweek)
);

alter table public.counter_usage enable row level security;

drop policy if exists "Users read own counter usage"             on public.counter_usage;
drop policy if exists "Service role can manage counter usage"    on public.counter_usage;

create policy "Users read own counter usage"
  on public.counter_usage for select
  using (auth.uid() = user_id);

create policy "Service role can manage counter usage"
  on public.counter_usage for all
  using (auth.role() = 'service_role');
