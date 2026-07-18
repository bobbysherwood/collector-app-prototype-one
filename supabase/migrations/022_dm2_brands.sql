-- Data Model v2: Brand links Manufacturer + Card Set Name
-- Idempotent: aligns dm2_brands if it already exists from prior dm2 work

create table if not exists public.dm2_brands (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  manufacturer_id uuid not null references public.dm2_manufacturers (id) on delete restrict,
  card_set_name_id uuid not null references public.dm2_card_set_names (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_brands_name_not_blank check (length(trim(name)) > 0)
);

alter table public.dm2_brands
  add column if not exists active boolean not null default true;

alter table public.dm2_brands
  add column if not exists updated_at timestamptz not null default now();

alter table public.dm2_brands
  alter column name type varchar(100);

alter table public.dm2_brands
  drop constraint if exists dm2_brands_card_set_id_fkey;

alter table public.dm2_brands
  drop column if exists card_set_id;

alter table public.dm2_brands
  add column if not exists card_set_name_id uuid references public.dm2_card_set_names (id) on delete restrict;

delete from public.dm2_brands
where card_set_name_id is null;

alter table public.dm2_brands
  alter column card_set_name_id set not null;

create unique index if not exists dm2_brands_manufacturer_name_unique
  on public.dm2_brands (manufacturer_id, lower(trim(name)));

create index if not exists dm2_brands_card_set_name_id_idx
  on public.dm2_brands (card_set_name_id);

create index if not exists dm2_brands_manufacturer_id_idx
  on public.dm2_brands (manufacturer_id);

alter table public.dm2_brands enable row level security;

drop policy if exists "Admins can view dm2 brands" on public.dm2_brands;
drop policy if exists "Admins can insert dm2 brands" on public.dm2_brands;
drop policy if exists "Admins can update dm2 brands" on public.dm2_brands;
drop policy if exists "Admins can delete dm2 brands" on public.dm2_brands;

drop policy if exists "Admins can view brands" on public.dm2_brands;
drop policy if exists "Admins can insert brands" on public.dm2_brands;
drop policy if exists "Admins can update brands" on public.dm2_brands;
drop policy if exists "Admins can delete brands" on public.dm2_brands;

create policy "Admins can view brands"
  on public.dm2_brands
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert brands"
  on public.dm2_brands
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update brands"
  on public.dm2_brands
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete brands"
  on public.dm2_brands
  for delete
  to authenticated
  using (public.is_admin());
