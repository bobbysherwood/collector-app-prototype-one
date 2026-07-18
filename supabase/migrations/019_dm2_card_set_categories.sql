-- Data Model v2: Card Set Category lookup table

create table public.dm2_card_set_categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_card_set_categories_name_not_blank check (length(trim(name)) > 0)
);

create unique index dm2_card_set_categories_name_unique
  on public.dm2_card_set_categories (lower(trim(name)));

alter table public.dm2_card_set_categories enable row level security;

create policy "Admins can view card set categories"
  on public.dm2_card_set_categories
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert card set categories"
  on public.dm2_card_set_categories
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update card set categories"
  on public.dm2_card_set_categories
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete card set categories"
  on public.dm2_card_set_categories
  for delete
  to authenticated
  using (public.is_admin());
