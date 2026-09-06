-- One graded-population record per catalog card. NULL = unknown; 0 = reported zero.

create table if not exists public.dm2_card_populations (
  card_id uuid primary key references public.dm2_cards (id) on delete cascade,
  psa_1 integer,
  psa_2 integer,
  psa_3 integer,
  psa_4 integer,
  psa_5 integer,
  psa_6 integer,
  psa_7 integer,
  psa_8 integer,
  psa_9 integer,
  psa_10 integer,
  bgs_1 integer,
  bgs_2 integer,
  bgs_3 integer,
  bgs_4 integer,
  bgs_5 integer,
  bgs_6 integer,
  bgs_7 integer,
  bgs_8 integer,
  bgs_9 integer,
  bgs_9_5 integer,
  bgs_10 integer,
  sgc_1 integer,
  sgc_2 integer,
  sgc_3 integer,
  sgc_4 integer,
  sgc_5 integer,
  sgc_6 integer,
  sgc_7 integer,
  sgc_8 integer,
  sgc_9 integer,
  sgc_9_5 integer,
  sgc_10 integer,
  cgc_1 integer,
  cgc_2 integer,
  cgc_3 integer,
  cgc_4 integer,
  cgc_5 integer,
  cgc_6 integer,
  cgc_7 integer,
  cgc_8 integer,
  cgc_9 integer,
  cgc_9_5 integer,
  cgc_10 integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_card_populations_psa_1_nonneg check (psa_1 is null or psa_1 >= 0),
  constraint dm2_card_populations_psa_2_nonneg check (psa_2 is null or psa_2 >= 0),
  constraint dm2_card_populations_psa_3_nonneg check (psa_3 is null or psa_3 >= 0),
  constraint dm2_card_populations_psa_4_nonneg check (psa_4 is null or psa_4 >= 0),
  constraint dm2_card_populations_psa_5_nonneg check (psa_5 is null or psa_5 >= 0),
  constraint dm2_card_populations_psa_6_nonneg check (psa_6 is null or psa_6 >= 0),
  constraint dm2_card_populations_psa_7_nonneg check (psa_7 is null or psa_7 >= 0),
  constraint dm2_card_populations_psa_8_nonneg check (psa_8 is null or psa_8 >= 0),
  constraint dm2_card_populations_psa_9_nonneg check (psa_9 is null or psa_9 >= 0),
  constraint dm2_card_populations_psa_10_nonneg check (psa_10 is null or psa_10 >= 0),
  constraint dm2_card_populations_bgs_1_nonneg check (bgs_1 is null or bgs_1 >= 0),
  constraint dm2_card_populations_bgs_2_nonneg check (bgs_2 is null or bgs_2 >= 0),
  constraint dm2_card_populations_bgs_3_nonneg check (bgs_3 is null or bgs_3 >= 0),
  constraint dm2_card_populations_bgs_4_nonneg check (bgs_4 is null or bgs_4 >= 0),
  constraint dm2_card_populations_bgs_5_nonneg check (bgs_5 is null or bgs_5 >= 0),
  constraint dm2_card_populations_bgs_6_nonneg check (bgs_6 is null or bgs_6 >= 0),
  constraint dm2_card_populations_bgs_7_nonneg check (bgs_7 is null or bgs_7 >= 0),
  constraint dm2_card_populations_bgs_8_nonneg check (bgs_8 is null or bgs_8 >= 0),
  constraint dm2_card_populations_bgs_9_nonneg check (bgs_9 is null or bgs_9 >= 0),
  constraint dm2_card_populations_bgs_9_5_nonneg check (bgs_9_5 is null or bgs_9_5 >= 0),
  constraint dm2_card_populations_bgs_10_nonneg check (bgs_10 is null or bgs_10 >= 0),
  constraint dm2_card_populations_sgc_1_nonneg check (sgc_1 is null or sgc_1 >= 0),
  constraint dm2_card_populations_sgc_2_nonneg check (sgc_2 is null or sgc_2 >= 0),
  constraint dm2_card_populations_sgc_3_nonneg check (sgc_3 is null or sgc_3 >= 0),
  constraint dm2_card_populations_sgc_4_nonneg check (sgc_4 is null or sgc_4 >= 0),
  constraint dm2_card_populations_sgc_5_nonneg check (sgc_5 is null or sgc_5 >= 0),
  constraint dm2_card_populations_sgc_6_nonneg check (sgc_6 is null or sgc_6 >= 0),
  constraint dm2_card_populations_sgc_7_nonneg check (sgc_7 is null or sgc_7 >= 0),
  constraint dm2_card_populations_sgc_8_nonneg check (sgc_8 is null or sgc_8 >= 0),
  constraint dm2_card_populations_sgc_9_nonneg check (sgc_9 is null or sgc_9 >= 0),
  constraint dm2_card_populations_sgc_9_5_nonneg check (sgc_9_5 is null or sgc_9_5 >= 0),
  constraint dm2_card_populations_sgc_10_nonneg check (sgc_10 is null or sgc_10 >= 0),
  constraint dm2_card_populations_cgc_1_nonneg check (cgc_1 is null or cgc_1 >= 0),
  constraint dm2_card_populations_cgc_2_nonneg check (cgc_2 is null or cgc_2 >= 0),
  constraint dm2_card_populations_cgc_3_nonneg check (cgc_3 is null or cgc_3 >= 0),
  constraint dm2_card_populations_cgc_4_nonneg check (cgc_4 is null or cgc_4 >= 0),
  constraint dm2_card_populations_cgc_5_nonneg check (cgc_5 is null or cgc_5 >= 0),
  constraint dm2_card_populations_cgc_6_nonneg check (cgc_6 is null or cgc_6 >= 0),
  constraint dm2_card_populations_cgc_7_nonneg check (cgc_7 is null or cgc_7 >= 0),
  constraint dm2_card_populations_cgc_8_nonneg check (cgc_8 is null or cgc_8 >= 0),
  constraint dm2_card_populations_cgc_9_nonneg check (cgc_9 is null or cgc_9 >= 0),
  constraint dm2_card_populations_cgc_9_5_nonneg check (cgc_9_5 is null or cgc_9_5 >= 0),
  constraint dm2_card_populations_cgc_10_nonneg check (cgc_10 is null or cgc_10 >= 0)
);

comment on table public.dm2_card_populations is
  'Graded population counts for one catalog card. One row per dm2_cards.id. NULL means unknown; 0 means reported zero.';

alter table public.dm2_card_populations enable row level security;

drop policy if exists "Admins can view card populations" on public.dm2_card_populations;
drop policy if exists "Admins can insert card populations" on public.dm2_card_populations;
drop policy if exists "Admins can update card populations" on public.dm2_card_populations;
drop policy if exists "Admins can delete card populations" on public.dm2_card_populations;

create policy "Admins can view card populations"
  on public.dm2_card_populations
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert card populations"
  on public.dm2_card_populations
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update card populations"
  on public.dm2_card_populations
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete card populations"
  on public.dm2_card_populations
  for delete
  to authenticated
  using (public.is_admin());

insert into public.dm2_entity_descriptions (entity_key, title, description, table_name, sort_order)
values
  (
    'card_population',
    'Card Population Table',
    'Stores graded population counts for one unique catalog card. Each row references exactly one Cards record and has one nullable integer column per grading-company/grade combination (PSA 1–10, BGS/SGC/CGC 1–10 including 9.5). NULL means the count is unknown; 0 means the grader reported zero. Do not duplicate card metadata here.',
    'dm2_card_populations',
    90
  )
on conflict (entity_key) do update
set
  title = excluded.title,
  description = excluded.description,
  table_name = excluded.table_name,
  sort_order = excluded.sort_order,
  updated_at = now();
