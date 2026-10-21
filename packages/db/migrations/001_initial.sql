-- Final Ball: initial schema
-- Run in the Supabase SQL editor (Project → SQL Editor → New query)
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE

-- ─── country_leagues ────────────────────────────────────────────────────────
-- Built once per season by the country-leagues script (D9.3f).
-- Maps country name → FPL classic league ID.
create table if not exists public.country_leagues (
  id        bigint generated always as identity primary key,
  season    integer  not null,
  country   text     not null,
  league_id integer  not null,
  created_at timestamptz not null default now(),
  unique (season, country)
);

alter table public.country_leagues enable row level security;

create policy "Anyone can read country leagues"
  on public.country_leagues for select
  using (true);

-- ─── standings_cache ────────────────────────────────────────────────────────
-- Cached standings pages used by the country-rank lookup (D9.3e).
create table if not exists public.standings_cache (
  id         bigint generated always as identity primary key,
  league_id  integer not null,
  page       integer not null,
  gameweek   integer not null,
  payload    jsonb   not null,
  fetched_at timestamptz not null default now(),
  unique (league_id, page, gameweek)
);

alter table public.standings_cache enable row level security;

create policy "Authenticated users can read standings cache"
  on public.standings_cache for select
  using (auth.role() = 'authenticated');

-- Service role (scripts/GitHub Actions) can write standings cache
create policy "Service role can write standings cache"
  on public.standings_cache for all
  using (auth.role() = 'service_role');

-- ─── fpl_cache ───────────────────────────────────────────────────────────────
-- Keyed cache for FPL API responses (bootstrap-static, fixtures, etc.).
-- Key format: "bootstrap", "fixtures", "element_summary:{id}", etc.
create table if not exists public.fpl_cache (
  key        text primary key,
  payload    jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.fpl_cache enable row level security;

create policy "Service role can manage fpl cache"
  on public.fpl_cache for all
  using (auth.role() = 'service_role');

create policy "Authenticated users can read fpl cache"
  on public.fpl_cache for select
  using (auth.role() = 'authenticated');

-- ─── users ──────────────────────────────────────────────────────────────────
-- One row per signed-in user, linked to auth.users.
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  google_sub    text unique,
  email         text not null,
  team_id       integer,
  email_opt_out boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users update own row"
  on public.users for update
  using (auth.uid() = id);

-- Auto-create a users row when someone signs in for the first time.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, google_sub, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'sub',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
