-- Asset / lot / sale model: multiple purchases and sales per collectible
-- Preserves existing card UUIDs as asset IDs for stable URLs.
-- Grading lives on lots; valuations are keyed by lot_id.

-- ---------------------------------------------------------------------------
-- Assets (card identity — no purchase, sale, or grading fields)
-- ---------------------------------------------------------------------------
create table public.assets (
  id uuid primary key,
  user_id uuid references auth.users on delete cascade not null,
  player_name text not null,
  year integer not null check (year >= 1800 and year <= 2100),
  card_type text not null,
  sport text not null,
  card_number text,
  insert_parallel text,
  image_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_user_id_idx on public.assets (user_id);
create index assets_sport_idx on public.assets (sport);

alter table public.assets enable row level security;

create policy "Users can view own assets"
  on public.assets for select
  using (auth.uid() = user_id);

create policy "Users can insert own assets"
  on public.assets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own assets"
  on public.assets for update
  using (auth.uid() = user_id);

create policy "Users can delete own assets"
  on public.assets for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Lots (each purchase / acquisition — includes grading)
-- ---------------------------------------------------------------------------
create table public.lots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  purchase_date date not null,
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  quantity_acquired integer not null default 1 check (quantity_acquired = 1),
  quantity_remaining integer not null default 1 check (quantity_remaining in (0, 1)),
  grader text not null,
  grade text,
  cert_number text,
  notes text,
  created_at timestamptz not null default now()
);

create index lots_asset_id_idx on public.lots (asset_id);
create index lots_user_id_idx on public.lots (user_id);
create index lots_purchase_date_idx on public.lots (purchase_date);

alter table public.lots enable row level security;

create policy "Users can view own lots"
  on public.lots for select
  using (auth.uid() = user_id);

create policy "Users can insert own lots"
  on public.lots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own lots"
  on public.lots for update
  using (auth.uid() = user_id);

create policy "Users can delete own lots"
  on public.lots for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Sale ↔ lot allocations (FIFO cost basis)
-- ---------------------------------------------------------------------------
create table public.sale_lot_allocations (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.card_sales on delete cascade not null,
  lot_id uuid references public.lots on delete restrict not null,
  quantity integer not null default 1 check (quantity = 1),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

create index sale_lot_allocations_sale_id_idx on public.sale_lot_allocations (sale_id);
create index sale_lot_allocations_lot_id_idx on public.sale_lot_allocations (lot_id);

alter table public.sale_lot_allocations enable row level security;

create policy "Users can view own sale lot allocations"
  on public.sale_lot_allocations for select
  using (
    exists (
      select 1 from public.card_sales s
      where s.id = sale_id and s.user_id = auth.uid()
    )
  );

create policy "Users can insert own sale lot allocations"
  on public.sale_lot_allocations for insert
  with check (
    exists (
      select 1 from public.card_sales s
      where s.id = sale_id and s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Extend card_sales + card_valuations to reference assets / lots
-- ---------------------------------------------------------------------------
alter table public.card_sales
  add column if not exists asset_id uuid references public.assets on delete set null;

alter table public.card_valuations
  add column if not exists asset_id uuid references public.assets on delete cascade;

alter table public.card_valuations
  add column if not exists lot_id uuid references public.lots on delete cascade;

create index if not exists card_sales_asset_id_idx on public.card_sales (asset_id);
create index if not exists card_valuations_asset_id_idx on public.card_valuations (asset_id);
create index if not exists card_valuations_lot_id_idx on public.card_valuations (lot_id);

-- ---------------------------------------------------------------------------
-- Migrate existing cards → assets + lots
-- ---------------------------------------------------------------------------
insert into public.assets (
  id,
  user_id,
  player_name,
  year,
  card_type,
  sport,
  card_number,
  insert_parallel,
  image_path,
  notes,
  created_at,
  updated_at
)
select
  id,
  user_id,
  player_name,
  year,
  card_type,
  sport,
  card_number,
  insert_parallel,
  image_path,
  notes,
  created_at,
  updated_at
from public.cards;

-- One lot per physical card (expand legacy quantity into separate lots)
insert into public.lots (
  asset_id,
  user_id,
  purchase_date,
  unit_cost,
  quantity_acquired,
  quantity_remaining,
  grader,
  grade,
  cert_number
)
select
  c.id,
  c.user_id,
  c.purchase_date,
  c.purchase_price,
  1,
  case when coalesce(c.status, 'held') = 'sold' then 0 else 1 end,
  c.grader,
  c.grade,
  c.cert_number
from public.cards c
cross join lateral generate_series(1, c.quantity) as gs(n);

update public.card_sales
set asset_id = card_id
where asset_id is null and card_id is not null;

update public.card_valuations
set asset_id = card_id
where asset_id is null and card_id is not null;

-- Point valuations at the first lot per legacy asset
update public.card_valuations v
set lot_id = l.id
from (
  select distinct on (asset_id) id, asset_id
  from public.lots
  order by asset_id, purchase_date, created_at
) l
where l.asset_id = v.asset_id
  and v.lot_id is null;

-- Backfill sale_lot_allocations: one row per unit sold
insert into public.sale_lot_allocations (sale_id, lot_id, quantity, unit_cost)
select
  s.id,
  rl.id,
  1,
  rl.unit_cost
from public.card_sales s
join lateral (
  select l.id, l.unit_cost
  from public.lots l
  where l.asset_id = s.asset_id
  order by l.purchase_date, l.created_at
  limit greatest(s.quantity, 1)
) rl on true
where not exists (
  select 1 from public.sale_lot_allocations a where a.sale_id = s.id
);

-- Legacy sold cards without a card_sales row
insert into public.card_sales (card_id, asset_id, user_id, sale_date, sale_price, quantity)
select
  c.id,
  c.id,
  c.user_id,
  c.sold_at,
  c.sold_price,
  c.quantity
from public.cards c
where coalesce(c.status, 'held') = 'sold'
  and c.sold_at is not null
  and c.sold_price is not null
  and not exists (
    select 1 from public.card_sales s where s.asset_id = c.id
  );

insert into public.sale_lot_allocations (sale_id, lot_id, quantity, unit_cost)
select
  s.id,
  rl.id,
  1,
  rl.unit_cost
from public.card_sales s
join lateral (
  select l.id, l.unit_cost
  from public.lots l
  where l.asset_id = s.asset_id
  order by l.purchase_date, l.created_at
  limit greatest(s.quantity, 1)
) rl on true
where not exists (
  select 1 from public.sale_lot_allocations a where a.sale_id = s.id
);

-- ---------------------------------------------------------------------------
-- Valuations keyed by lot; drop legacy card / asset FK columns
-- ---------------------------------------------------------------------------
alter table public.card_valuations alter column lot_id set not null;

alter table public.card_valuations drop constraint if exists card_valuations_card_id_fkey;
alter table public.card_valuations drop column if exists card_id;
alter table public.card_valuations drop column if exists asset_id;

drop index if exists card_valuations_card_id_idx;
drop index if exists card_valuations_card_recorded_idx;
drop index if exists card_valuations_asset_id_idx;
drop index if exists card_valuations_asset_recorded_idx;
create index card_valuations_lot_recorded_idx
  on public.card_valuations (lot_id, recorded_at desc);

-- card_sales: asset_id is canonical; keep card_id nullable for audit trail
alter table public.card_sales drop constraint if exists card_sales_card_id_fkey;

-- Drop legacy cards table (data lives in assets + lots)
drop table if exists public.cards cascade;

-- Updated-at trigger for assets
create or replace function public.set_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assets_updated_at
  before update on public.assets
  for each row
  execute function public.set_assets_updated_at();
