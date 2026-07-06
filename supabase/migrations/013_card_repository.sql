-- Card repository for admin-managed set checklists

create table public.card_repository (
  id uuid primary key default gen_random_uuid(),
  category varchar(50) not null,
  year smallint not null check (year >= 1800 and year <= 2100),
  manufacturer varchar(100) not null,
  brand varchar(100) not null,
  card_set_category varchar(100) not null,
  card_set varchar(100) not null,
  card_number varchar(20) not null,
  player varchar(100) not null,
  parallel varchar(100),
  serial_number smallint check (serial_number is null or serial_number > 0),
  release_date date,
  created_at timestamptz not null default now()
);

create unique index card_repository_unique_entry_idx on public.card_repository (
  lower(trim(category)),
  year,
  lower(trim(manufacturer)),
  lower(trim(brand)),
  lower(trim(card_set)),
  lower(trim(card_number)),
  lower(trim(player)),
  lower(trim(coalesce(parallel, '')))
);

create index card_repository_set_group_idx
  on public.card_repository (category, year, manufacturer, brand, card_set);

alter table public.card_repository enable row level security;

create policy "Admins can view card repository"
  on public.card_repository for select
  using (public.is_admin());

create policy "Admins can insert card repository"
  on public.card_repository for insert
  with check (public.is_admin());

create policy "Admins can update card repository"
  on public.card_repository for update
  using (public.is_admin());

create policy "Admins can delete card repository"
  on public.card_repository for delete
  using (public.is_admin());

create or replace function public.admin_list_card_repository_sets()
returns table (
  category text,
  year smallint,
  manufacturer text,
  brand text,
  card_set text,
  cards bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    cr.category,
    cr.year,
    cr.manufacturer,
    cr.brand,
    cr.card_set,
    count(*)::bigint as cards
  from public.card_repository cr
  where public.is_admin()
  group by cr.category, cr.year, cr.manufacturer, cr.brand, cr.card_set
  order by cr.year desc, cr.card_set asc, cr.brand asc;
$$;

revoke all on function public.admin_list_card_repository_sets() from public;
grant execute on function public.admin_list_card_repository_sets() to authenticated;
