-- Data Model v2: Card Set Name lookup table

create table public.dm2_card_set_names (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_card_set_names_name_not_blank check (length(trim(name)) > 0)
);

create unique index dm2_card_set_names_name_unique
  on public.dm2_card_set_names (lower(trim(name)));

alter table public.dm2_card_set_names enable row level security;

create policy "Admins can view card set names"
  on public.dm2_card_set_names
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert card set names"
  on public.dm2_card_set_names
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update card set names"
  on public.dm2_card_set_names
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete card set names"
  on public.dm2_card_set_names
  for delete
  to authenticated
  using (public.is_admin());
