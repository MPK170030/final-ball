-- Final Ball: sample_brief table (004)
-- Safe to re-run: all DDL uses IF NOT EXISTS / OR REPLACE guards.
-- Run in Supabase: Project → SQL Editor → New query.

-- ── sample_brief ──────────────────────────────────────────────────────────────
-- Stores a single pre-generated brief for the public /sample page (D16.3, D16.10).
-- Key is always 'current'. Refreshed via POST /api/sample/refresh (owner-auth-gated).
-- Cards and trace are stored as JSON arrays to avoid joins on public reads.

create table if not exists public.sample_brief (
  key          text        not null default 'current',
  gameweek     integer     not null,
  version      integer     not null default 1,
  trace        jsonb       not null default '[]'::jsonb,
  cards        jsonb       not null default '[]'::jsonb,
  meta         jsonb       not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  primary key (key)
);

alter table public.sample_brief enable row level security;

drop policy if exists "sample_brief_public_read" on public.sample_brief;
drop policy if exists "sample_brief_service_write" on public.sample_brief;

-- Anyone (including anon) can read the sample brief
create policy "sample_brief_public_read"
  on public.sample_brief for select
  using (true);

-- Only the service role can write (bypasses RLS naturally, but being explicit)
create policy "sample_brief_service_write"
  on public.sample_brief for all
  using (auth.role() = 'service_role');
