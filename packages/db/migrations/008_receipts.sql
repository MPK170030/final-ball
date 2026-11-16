-- Final Ball: receipts pipeline (008)
-- Safe to re-run: all DDL uses IF NOT EXISTS / IF EXISTS guards.
-- Run in Supabase: Project → SQL Editor → New query.
-- Decisions: D7.1–D7.11 (transfer receipts, scorecard, journal, intent inference).

-- ── 1. decisions ──────────────────────────────────────────────────────────────
-- One row per transfer decision detected by the daily job after the deadline.
-- label:
--   followed             = user made the agent's top pick or one of its alternatives (D7.11)
--   own_move             = user transferred in a player not on the brief
--   ignored_rolled       = user kept their free transfer (brief suggested a move)
--   ignored_transferred  = user made a different move than the brief suggested
-- risk_tag: the tag of the pick the user actually made, used by the scorecard (D2.5).
-- actual_move: raw FPL transfer object { element_in, element_out, event, time, ... }
-- card_id: nullable — absent when label is own_move or no card matched the GW.
create table if not exists public.decisions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  gameweek     integer     not null,
  card_id      uuid        references public.cards(id) on delete set null,
  label        text        not null
                 check (label in ('followed', 'own_move', 'ignored_rolled', 'ignored_transferred')),
  risk_tag     text        check (risk_tag in ('safe', 'balanced', 'bold')),
  actual_move  jsonb,
  journal_note text,
  detected_at  timestamptz not null default now()
);

-- Primary access pattern: "all decisions for a user, by GW descending"
create index if not exists decisions_user_id_gameweek_idx
  on public.decisions (user_id, gameweek desc);

alter table public.decisions enable row level security;

drop policy if exists "Users read own decisions"          on public.decisions;
drop policy if exists "Service role can manage decisions" on public.decisions;

create policy "Users read own decisions"
  on public.decisions for select
  using (auth.uid() = user_id);

create policy "Service role can manage decisions"
  on public.decisions for all
  using (auth.role() = 'service_role');

-- ── 2. intents ────────────────────────────────────────────────────────────────
-- One row per decision; the inferred intent and any user correction (D7.8).
-- linked_decision_id: set when this is a suspected funding move — points to the
--   follow-up transfer that completes the two-step plan (D7.9).
create table if not exists public.intents (
  decision_id        uuid  primary key references public.decisions(id) on delete cascade,
  inferred           text  not null
                       check (inferred in ('points', 'funding', 'injury_cover')),
  corrected_by_user  text  check (corrected_by_user in ('points', 'funding', 'injury_cover')),
  linked_decision_id uuid  references public.decisions(id) on delete set null
);

alter table public.intents enable row level security;

drop policy if exists "Users read own intents"          on public.intents;
drop policy if exists "Service role can manage intents" on public.intents;

create policy "Users read own intents"
  on public.intents for select
  using (
    exists (
      select 1 from public.decisions
      where decisions.id = decision_id
        and decisions.user_id = auth.uid()
    )
  );

create policy "Service role can manage intents"
  on public.intents for all
  using (auth.role() = 'service_role');

-- ── 3. receipts ───────────────────────────────────────────────────────────────
-- One row per decision; tracks the 3-GW outcome window (D7.2, D7.7).
-- window_start_gw: the first GW the incoming player plays (GW of transfer + 1).
-- window_end_gw:   window_start_gw + 2 (3 gameweeks total).
-- player_in_pts / player_out_pts: total pts over the window; set when settled.
-- delta_pts: player_in_pts − player_out_pts (positive = the move helped).
create table if not exists public.receipts (
  decision_id     uuid        primary key references public.decisions(id) on delete cascade,
  window_start_gw integer     not null,
  window_end_gw   integer     not null,
  player_in_pts   integer,
  player_out_pts  integer,
  delta_pts       integer,
  status          text        not null default 'pending'
                    check (status in ('pending', 'settled')),
  settled_at      timestamptz
);

-- Daily settlement query: "all pending receipts whose window has now closed"
create index if not exists receipts_status_window_idx
  on public.receipts (status, window_end_gw)
  where status = 'pending';

alter table public.receipts enable row level security;

drop policy if exists "Users read own receipts"          on public.receipts;
drop policy if exists "Service role can manage receipts" on public.receipts;

create policy "Users read own receipts"
  on public.receipts for select
  using (
    exists (
      select 1 from public.decisions
      where decisions.id = decision_id
        and decisions.user_id = auth.uid()
    )
  );

create policy "Service role can manage receipts"
  on public.receipts for all
  using (auth.role() = 'service_role');
