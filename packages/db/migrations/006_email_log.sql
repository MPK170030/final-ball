-- Final Ball: email log (006)
-- Safe to re-run: all DDL uses IF NOT EXISTS guards.
-- Run in Supabase: Project → SQL Editor → New query.
-- Records one row per email sent by the weekly brief job.
-- Idempotency: the weekly script checks for a 'sent' row before sending.

create table if not exists public.email_log (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  gameweek    integer     not null,
  brief_id    uuid        references public.briefs(id) on delete set null,
  status      text        not null check (status in ('sent', 'failed')),
  error       text,
  sent_at     timestamptz not null default now()
);

create index if not exists email_log_user_gameweek_idx
  on public.email_log (user_id, gameweek);

alter table public.email_log enable row level security;

drop policy if exists "Users read own email log"           on public.email_log;
drop policy if exists "Service role can manage email log"  on public.email_log;

create policy "Users read own email log"
  on public.email_log for select
  using (auth.uid() = user_id);

create policy "Service role can manage email log"
  on public.email_log for all
  using (auth.role() = 'service_role');
