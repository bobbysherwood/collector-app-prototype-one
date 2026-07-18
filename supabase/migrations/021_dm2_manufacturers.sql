-- Data Model v2: Manufacturer lookup table
-- Idempotent: aligns dm2_manufacturers if it already exists from prior dm2 work

create table if not exists public.dm2_manufacturers (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_manufacturers_name_not_blank check (length(trim(name)) > 0)
);

alter table public.dm2_manufacturers
  add column if not exists active boolean not null default true;

alter table public.dm2_manufacturers
  add column if not exists updated_at timestamptz not null default now();

alter table public.dm2_manufacturers
  alter column name type varchar(100);

create unique index if not exists dm2_manufacturers_name_unique
  on public.dm2_manufacturers (lower(trim(name)));

alter table public.dm2_manufacturers enable row level security;

-- Legacy policies from 019_data_model_v2_hierarchy
drop policy if exists "Admins can view dm2 manufacturers" on public.dm2_manufacturers;
drop policy if exists "Admins can insert dm2 manufacturers" on public.dm2_manufacturers;
drop policy if exists "Admins can update dm2 manufacturers" on public.dm2_manufacturers;
drop policy if exists "Admins can delete dm2 manufacturers" on public.dm2_manufacturers;

drop policy if exists "Admins can view manufacturers" on public.dm2_manufacturers;
drop policy if exists "Admins can insert manufacturers" on public.dm2_manufacturers;
drop policy if exists "Admins can update manufacturers" on public.dm2_manufacturers;
drop policy if exists "Admins can delete manufacturers" on public.dm2_manufacturers;

create policy "Admins can view manufacturers"
  on public.dm2_manufacturers
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert manufacturers"
  on public.dm2_manufacturers
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update manufacturers"
  on public.dm2_manufacturers
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete manufacturers"
  on public.dm2_manufacturers
  for delete
  to authenticated
  using (public.is_admin());
