-- Data Model v2: Card Set composite lookup (sport, year, brand, category, name)

create table if not exists public.dm2_card_sets (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.pick_list_options (id) on delete restrict,
  year smallint not null check (year >= 1800 and year <= 2100),
  brand_id uuid not null references public.dm2_brands (id) on delete restrict,
  card_set_category_id uuid not null references public.dm2_card_set_categories (id) on delete restrict,
  card_set_name_id uuid not null references public.dm2_card_set_names (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dm2_card_sets_unique_entry_idx
  on public.dm2_card_sets (
    sport_id,
    year,
    brand_id,
    card_set_category_id,
    card_set_name_id
  );

create index if not exists dm2_card_sets_sport_id_idx
  on public.dm2_card_sets (sport_id);

create index if not exists dm2_card_sets_brand_id_idx
  on public.dm2_card_sets (brand_id);

create index if not exists dm2_card_sets_year_idx
  on public.dm2_card_sets (year);

alter table public.dm2_card_sets enable row level security;

drop policy if exists "Admins can view card sets" on public.dm2_card_sets;
drop policy if exists "Admins can insert card sets" on public.dm2_card_sets;
drop policy if exists "Admins can update card sets" on public.dm2_card_sets;
drop policy if exists "Admins can delete card sets" on public.dm2_card_sets;

create policy "Admins can view card sets"
  on public.dm2_card_sets
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert card sets"
  on public.dm2_card_sets
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update card sets"
  on public.dm2_card_sets
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete card sets"
  on public.dm2_card_sets
  for delete
  to authenticated
  using (public.is_admin());
