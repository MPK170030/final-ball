-- Final Ball: schema rework (002)
-- Safe to re-run: all DDL uses IF NOT EXISTS / IF EXISTS guards.
-- Run in Supabase: Project → SQL Editor → New query.

-- ── 1. Rename users → profiles ───────────────────────────────────────────────
-- Renames the table only when users exists and profiles does not yet,
-- so re-runs are safe.
do $$ begin
  if exists (
    select from pg_tables where schemaname = 'public' and tablename = 'users'
  ) and not exists (
    select from pg_tables where schemaname = 'public' and tablename = 'profiles'
  ) then
    alter table public.users rename to profiles;
  end if;
end $$;

-- New onboarding columns (no-ops on re-run)
alter table public.profiles
  add column if not exists team_name    text,
  add column if not exists manager_name text,
  add column if not exists country      text;

-- Service role needs write access to profiles during onboarding
drop policy if exists "Service role can manage profiles" on public.profiles;
create policy "Service role can manage profiles"
  on public.profiles for all
  using (auth.role() = 'service_role');

-- ── 2. Update trigger to use profiles ────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, google_sub, email)
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

-- ── 3. Fix standings_cache primary key ───────────────────────────────────────
-- The original schema used a surrogate id. The natural key
-- (league_id, page, gameweek) is what all queries use, so promote it to PK.
do $$ begin
  if exists (
    select from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'standings_cache'
      and column_name  = 'id'
  ) then
    alter table public.standings_cache drop constraint if exists standings_cache_pkey;
    alter table public.standings_cache drop constraint if exists standings_cache_league_id_page_gameweek_key;
    alter table public.standings_cache drop column id;
    alter table public.standings_cache add primary key (league_id, page, gameweek);
  end if;
end $$;

-- ── 4. briefs ────────────────────────────────────────────────────────────────
-- One row per (user, gameweek, version). Version increments on each Refresh.
-- payload  = full brief content (cards, reasoning); null while generating.
-- trace    = agent reasoning trace for "How the agent decided" (D8.4).
-- status   transitions: generating → ready | error.
create table if not exists public.briefs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  gameweek     integer     not null,
  version      integer     not null default 1,
  status       text        not null default 'generating'
                 check (status in ('generating', 'ready', 'error')),
  payload      jsonb,
  trace        jsonb,
  error        text,
  generated_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, gameweek, version)
);

create index if not exists briefs_user_gameweek_idx
  on public.briefs (user_id, gameweek);

alter table public.briefs enable row level security;

drop policy if exists "Users read own briefs"        on public.briefs;
drop policy if exists "Service role can manage briefs" on public.briefs;

create policy "Users read own briefs"
  on public.briefs for select
  using (auth.uid() = user_id);

create policy "Service role can manage briefs"
  on public.briefs for all
  using (auth.role() = 'service_role');

-- ── 5. cards ─────────────────────────────────────────────────────────────────
-- Individual recommendation cards within a brief (D8.1, D8.2).
-- position = display order within the brief.
-- payload  = card-specific content (player picks, reasons, etc.).
create table if not exists public.cards (
  id         uuid        primary key default gen_random_uuid(),
  brief_id   uuid        not null references public.briefs(id) on delete cascade,
  type       text        not null
               check (type in ('transfer', 'captain', 'chip', 'preview', 'checkin')),
  position   integer     not null,
  payload    jsonb       not null,
  created_at timestamptz not null default now()
);

create index if not exists cards_brief_id_idx
  on public.cards (brief_id);

alter table public.cards enable row level security;

drop policy if exists "Users read cards from own briefs"  on public.cards;
drop policy if exists "Service role can manage cards"     on public.cards;

create policy "Users read cards from own briefs"
  on public.cards for select
  using (
    exists (
      select 1 from public.briefs
      where briefs.id = brief_id
        and briefs.user_id = auth.uid()
    )
  );

create policy "Service role can manage cards"
  on public.cards for all
  using (auth.role() = 'service_role');

-- ── 6. generation_usage ──────────────────────────────────────────────────────
-- Per-user daily cap on brief generation (D16.5, US-10.8).
-- Replaced by the per-gameweek Refresh cap once that ships.
-- Increment pattern: upsert with count + 1, check count < daily_limit before.
create table if not exists public.generation_usage (
  user_id uuid    not null references public.profiles(id) on delete cascade,
  date    date    not null default current_date,
  count   integer not null default 0,
  primary key (user_id, date)
);

alter table public.generation_usage enable row level security;

drop policy if exists "Users read own usage"              on public.generation_usage;
drop policy if exists "Service role can manage generation usage" on public.generation_usage;

create policy "Users read own usage"
  on public.generation_usage for select
  using (auth.uid() = user_id);

create policy "Service role can manage generation usage"
  on public.generation_usage for all
  using (auth.role() = 'service_role');
