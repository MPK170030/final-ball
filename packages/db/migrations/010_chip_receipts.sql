-- Final Ball: chip receipts (010)
-- Safe to re-run: all DDL uses IF NOT EXISTS / IF EXISTS guards.
-- Run in Supabase: Project → SQL Editor → New query.
-- IMPORTANT: run this before deploying code that writes kind='chip' or chip labels.
-- Decisions: US-5.5 chip receipts.

-- ── 1. decisions — extend kind check to include 'chip' ───────────────────────
alter table public.decisions
  drop constraint if exists decisions_kind_check;

alter table public.decisions
  add constraint decisions_kind_check check (kind in ('transfer', 'captain', 'chip'));

-- ── 2. decisions — extend label check to include chip labels ─────────────────
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
      'captain_ignored',
      'chip_followed',
      'chip_ignored'
    )
  );
