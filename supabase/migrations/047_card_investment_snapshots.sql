-- Card Investment AI V1: profile snapshots and prediction history for ML migration

create table public.card_investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  profile jsonb not null,
  model_version text not null default 'card-investment-v1.0.0',
  computed_at timestamptz not null default now()
);

create index card_investment_snapshots_asset_computed_idx
  on public.card_investment_snapshots (asset_id, computed_at desc);

create table public.card_investment_prediction_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  as_of timestamptz not null,
  horizon_days integer not null,
  predicted_value numeric,
  actual_value numeric,
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint card_investment_prediction_horizon_positive check (horizon_days > 0)
);

create index card_investment_prediction_asset_as_of_idx
  on public.card_investment_prediction_history (asset_id, as_of desc);

alter table public.card_investment_snapshots enable row level security;
alter table public.card_investment_prediction_history enable row level security;

create policy "Users can read card investment snapshots for own assets"
  on public.card_investment_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assets
      where assets.id = card_investment_snapshots.asset_id
        and assets.user_id = auth.uid()
    )
  );

create policy "Users can insert card investment snapshots for own assets"
  on public.card_investment_snapshots
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.assets
      where assets.id = card_investment_snapshots.asset_id
        and assets.user_id = auth.uid()
    )
  );

create policy "Users can read card investment predictions for own assets"
  on public.card_investment_prediction_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assets
      where assets.id = card_investment_prediction_history.asset_id
        and assets.user_id = auth.uid()
    )
  );

create policy "Users can insert card investment predictions for own assets"
  on public.card_investment_prediction_history
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.assets
      where assets.id = card_investment_prediction_history.asset_id
        and assets.user_id = auth.uid()
    )
  );
