-- Add 'lineup' to the allowed card types (D4.5 lineup recommendation card).
-- PostgreSQL doesn't support altering check constraints in-place; drop and re-add.

alter table public.cards
  drop constraint if exists cards_type_check;

alter table public.cards
  add constraint cards_type_check
  check (type in ('transfer', 'captain', 'chip', 'preview', 'checkin', 'lineup'));
