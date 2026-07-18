-- Data Model v2: Cards linked to card sets and optional parallels

create table if not exists public.dm2_cards (
  id uuid primary key default gen_random_uuid(),
  card_set_id uuid not null references public.dm2_card_sets (id) on delete restrict,
  card_number varchar(100) not null,
  player varchar(100) not null,
  parallel_id uuid references public.dm2_parallels (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_cards_card_number_not_blank check (length(trim(card_number)) > 0),
  constraint dm2_cards_player_not_blank check (length(trim(player)) > 0)
);

create unique index if not exists dm2_cards_unique_entry_idx
  on public.dm2_cards (
    card_set_id,
    lower(trim(card_number)),
    lower(trim(player)),
    coalesce(parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists dm2_cards_card_set_id_idx
  on public.dm2_cards (card_set_id);

create index if not exists dm2_cards_parallel_id_idx
  on public.dm2_cards (parallel_id);

alter table public.dm2_cards enable row level security;

drop policy if exists "Admins can view dm2 cards" on public.dm2_cards;
drop policy if exists "Admins can insert dm2 cards" on public.dm2_cards;
drop policy if exists "Admins can update dm2 cards" on public.dm2_cards;
drop policy if exists "Admins can delete dm2 cards" on public.dm2_cards;

drop policy if exists "Admins can view cards" on public.dm2_cards;
drop policy if exists "Admins can insert cards" on public.dm2_cards;
drop policy if exists "Admins can update cards" on public.dm2_cards;
drop policy if exists "Admins can delete cards" on public.dm2_cards;

create policy "Admins can view cards"
  on public.dm2_cards
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert cards"
  on public.dm2_cards
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update cards"
  on public.dm2_cards
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete cards"
  on public.dm2_cards
  for delete
  to authenticated
  using (public.is_admin());
