-- Player Opportunity & Player/Card Opportunity model snapshots (V1)

create table public.player_opportunity_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  opportunity jsonb not null,
  model_version text not null default 'player-opportunity-v1.0.0',
  computed_at timestamptz not null default now()
);

create index player_opportunity_snapshots_player_computed_idx
  on public.player_opportunity_snapshots (player_id, computed_at desc);

create table public.player_card_opportunity_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  opportunity jsonb not null,
  model_version text not null default 'player-card-opportunity-v1.0.0',
  computed_at timestamptz not null default now()
);

create index player_card_opportunity_snapshots_asset_computed_idx
  on public.player_card_opportunity_snapshots (asset_id, computed_at desc);

create table public.player_opportunity_prediction_history (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  asset_id uuid references public.assets (id) on delete set null,
  as_of timestamptz not null,
  horizon_days integer not null,
  predicted_score numeric not null,
  actual_score numeric,
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint player_opportunity_prediction_horizon_positive check (horizon_days > 0)
);

create index player_opportunity_prediction_player_as_of_idx
  on public.player_opportunity_prediction_history (player_id, as_of desc);

alter table public.player_opportunity_snapshots enable row level security;
alter table public.player_card_opportunity_snapshots enable row level security;
alter table public.player_opportunity_prediction_history enable row level security;

create policy "Authenticated users can read player opportunity snapshots"
  on public.player_opportunity_snapshots
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert player opportunity snapshots"
  on public.player_opportunity_snapshots
  for insert
  to authenticated
  with check (true);

create policy "Users can read player card opportunity for own assets"
  on public.player_card_opportunity_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1 from public.assets
      where assets.id = player_card_opportunity_snapshots.asset_id
        and assets.user_id = auth.uid()
    )
  );

create policy "Users can insert player card opportunity for own assets"
  on public.player_card_opportunity_snapshots
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.assets
      where assets.id = player_card_opportunity_snapshots.asset_id
        and assets.user_id = auth.uid()
    )
  );

create policy "Authenticated users can read player opportunity predictions"
  on public.player_opportunity_prediction_history
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert player opportunity predictions"
  on public.player_opportunity_prediction_history
  for insert
  to authenticated
  with check (true);
