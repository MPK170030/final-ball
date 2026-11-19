-- Final Ball: captain receipts (009)
-- Safe to re-run: all DDL uses IF NOT EXISTS / IF EXISTS guards.
-- Run in Supabase: Project → SQL Editor → New query.
-- Decisions: US-5.5 (captain receipts), US-5.8 (counter records settlement).

-- ── 1. decisions — add kind column ───────────────────────────────────────────
-- kind discriminates between transfer and captain decision rows.
-- Existing rows get kind = 'transfer' (the default).
alter table public.decisions
  add column if not exists kind text not null default 'transfer';

alter table public.decisions
  drop constraint if exists decisions_kind_check;

alter table public.decisions
  add constraint decisions_kind_check check (kind in ('transfer', 'captain'));

-- ── 2. decisions — extend label check ────────────────────────────────────────
-- Drop the old transfer-only constraint and replace with one that covers both
-- transfer labels (unchanged) and captain labels (captain_followed, captain_ignored).
alter table public.decisions
  drop constraint if exists decisions_label_check;

alter table public.decisions
  add constraint decisions_label_check check (
    label in (
      'followed',
      'own_move',
      'ignored_rolled',
      'ignored_transferred',
      'captain_followed',
      'captain_ignored'
    )
  );
