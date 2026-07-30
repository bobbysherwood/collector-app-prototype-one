-- Data Model v2: card attributes (tags on catalog cards)

create table if not exists public.dm2_attributes (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_attributes_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists dm2_attributes_name_unique
  on public.dm2_attributes (lower(trim(name)));

alter table public.dm2_attributes enable row level security;

drop policy if exists "Admins can view attributes" on public.dm2_attributes;
drop policy if exists "Admins can insert attributes" on public.dm2_attributes;
drop policy if exists "Admins can update attributes" on public.dm2_attributes;
drop policy if exists "Admins can delete attributes" on public.dm2_attributes;

create policy "Admins can view attributes"
  on public.dm2_attributes
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert attributes"
  on public.dm2_attributes
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update attributes"
  on public.dm2_attributes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete attributes"
  on public.dm2_attributes
  for delete
  to authenticated
  using (public.is_admin());

create table if not exists public.dm2_card_attributes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.dm2_cards (id) on delete cascade,
  attribute_id uuid not null references public.dm2_attributes (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint dm2_card_attributes_unique_entry unique (card_id, attribute_id)
);

create index if not exists dm2_card_attributes_card_id_idx
  on public.dm2_card_attributes (card_id);

create index if not exists dm2_card_attributes_attribute_id_idx
  on public.dm2_card_attributes (attribute_id);

alter table public.dm2_card_attributes enable row level security;

drop policy if exists "Admins can view card attributes" on public.dm2_card_attributes;
drop policy if exists "Admins can insert card attributes" on public.dm2_card_attributes;
drop policy if exists "Admins can update card attributes" on public.dm2_card_attributes;
drop policy if exists "Admins can delete card attributes" on public.dm2_card_attributes;

create policy "Admins can view card attributes"
  on public.dm2_card_attributes
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert card attributes"
  on public.dm2_card_attributes
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update card attributes"
  on public.dm2_card_attributes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete card attributes"
  on public.dm2_card_attributes
  for delete
  to authenticated
  using (public.is_admin());

insert into public.dm2_attributes (name, active)
select seed.name, true
from (
  values
    ('Rookie Card'),
    ('Serial Numbered'),
    ('Autographed'),
    ('Memorabilia'),
    ('Case Hit')
) as seed(name)
where not exists (
  select 1
  from public.dm2_attributes existing
  where lower(trim(existing.name)) = lower(trim(seed.name))
);
