-- Final Ball: lookup_usage table (003)
-- Safe to re-run: all DDL uses IF NOT EXISTS guards.
-- Run in Supabase: Project → SQL Editor → New query.

-- ── lookup_usage ──────────────────────────────────────────────────────────────
-- Per-user hourly cap on FPL team lookups (D9.12).
-- hour_bucket = UTC hour prefix e.g. '2026-10-22T14' (ISO 8601 slice 0..12).
-- Increment pattern: upsert with count + 1, check count < 10 before.
create table if not exists public.lookup_usage (
  user_id     uuid    not null references public.profiles(id) on delete cascade,
  hour_bucket text    not null,
  count       integer not null default 0,
  primary key (user_id, hour_bucket)
);

alter table public.lookup_usage enable row level security;

drop policy if exists "Users read own lookup usage"          on public.lookup_usage;
drop policy if exists "Service role can manage lookup usage" on public.lookup_usage;

create policy "Users read own lookup usage"
  on public.lookup_usage for select
  using (auth.uid() = user_id);

create policy "Service role can manage lookup usage"
  on public.lookup_usage for all
  using (auth.role() = 'service_role');
