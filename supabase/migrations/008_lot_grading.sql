-- Per-lot grading migration for databases that already ran the old 007_assets_lots.sql
-- Moves grader / grade / cert_number from assets → lots; valuations asset_id → lot_id

-- ---------------------------------------------------------------------------
-- Add grading columns to lots
-- ---------------------------------------------------------------------------
alter table public.lots
  add column if not exists grader text,
  add column if not exists grade text,
  add column if not exists cert_number text;

-- Copy grading from assets onto their lots
update public.lots l
set
  grader = a.grader,
  grade = a.grade,
  cert_number = a.cert_number
from public.assets a
where l.asset_id = a.id
  and l.grader is null;

update public.lots
set grader = 'Raw'
where grader is null;

alter table public.lots
  alter column grader set not null;

-- ---------------------------------------------------------------------------
-- Remove grading from assets
-- ---------------------------------------------------------------------------
alter table public.assets drop column if exists grader;
alter table public.assets drop column if exists grade;
alter table public.assets drop column if exists cert_number;

-- ---------------------------------------------------------------------------
-- Migrate valuations from asset_id → lot_id
-- ---------------------------------------------------------------------------
alter table public.card_valuations
  add column if not exists lot_id uuid references public.lots on delete cascade;

-- Each asset-level valuation maps to the earliest lot for that asset
update public.card_valuations v
set lot_id = (
  select l.id
  from public.lots l
  where l.asset_id = v.asset_id
  order by l.purchase_date asc, l.created_at asc
  limit 1
)
where v.lot_id is null
  and v.asset_id is not null;

alter table public.card_valuations alter column lot_id set not null;

alter table public.card_valuations drop column if exists asset_id;

drop index if exists card_valuations_asset_id_idx;
drop index if exists card_valuations_asset_recorded_idx;
create index if not exists card_valuations_lot_recorded_idx
  on public.card_valuations (lot_id, recorded_at desc);
create index if not exists card_valuations_lot_id_idx
  on public.card_valuations (lot_id);
