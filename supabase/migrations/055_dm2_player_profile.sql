alter table public.dm2_players
  add column if not exists birth_year integer,
  add column if not exists career_status text
    check (career_status is null or career_status in ('prospect', 'active', 'retired', 'deceased')),
  add column if not exists injury_status text
    check (injury_status is null or injury_status in ('healthy', 'injured')),
  add column if not exists team text;

comment on column public.dm2_players.birth_year is
  'Optional player birth year for as-of lifecycle and outlook scoring.';
comment on column public.dm2_players.career_status is
  'Explicit career status. When set, opportunity models prefer this over name heuristics.';
