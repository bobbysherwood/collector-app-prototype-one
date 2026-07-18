-- Data Model v2: Parallel lookup table

create table if not exists public.dm2_parallels (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_parallels_name_not_blank check (length(trim(name)) > 0)
);

alter table public.dm2_parallels
  add column if not exists active boolean not null default true;

alter table public.dm2_parallels
  add column if not exists updated_at timestamptz not null default now();

alter table public.dm2_parallels
  alter column name type varchar(100);

create unique index if not exists dm2_parallels_name_unique
  on public.dm2_parallels (lower(trim(name)));

alter table public.dm2_parallels enable row level security;

drop policy if exists "Admins can view parallels" on public.dm2_parallels;
drop policy if exists "Admins can insert parallels" on public.dm2_parallels;
drop policy if exists "Admins can update parallels" on public.dm2_parallels;
drop policy if exists "Admins can delete parallels" on public.dm2_parallels;

create policy "Admins can view parallels"
  on public.dm2_parallels
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert parallels"
  on public.dm2_parallels
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update parallels"
  on public.dm2_parallels
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete parallels"
  on public.dm2_parallels
  for delete
  to authenticated
  using (public.is_admin());
