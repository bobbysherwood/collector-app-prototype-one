-- Sport Market Index V1: configs, feature time series, snapshots, and cache

create table public.sport_market_index_configs (
  id text primary key,
  name text not null,
  active boolean not null default true,
  pick_list_sport_id uuid references public.pick_list_options (id) on delete set null,
  season_config jsonb not null default '{}'::jsonb,
  search_terms jsonb not null default '{}'::jsonb,
  provider_config jsonb not null default '{}'::jsonb,
  index_weights jsonb not null default '{}'::jsonb,
  forecast_config jsonb not null default '{}'::jsonb,
  season_modifiers jsonb not null default '{}'::jsonb,
  risk_thresholds jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_market_index_configs_id_not_blank check (length(trim(id)) > 0),
  constraint sport_market_index_configs_name_not_blank check (length(trim(name)) > 0)
);

create index sport_market_index_configs_active_sort_idx
  on public.sport_market_index_configs (active, sort_order, name);

create table public.sport_market_features (
  id uuid primary key default gen_random_uuid(),
  sport_id text not null references public.sport_market_index_configs (id) on delete cascade,
  feature_key text not null,
  feature_category text not null,
  value numeric not null,
  z_score numeric,
  delta_30d_pct numeric,
  provider_slug text not null default '',
  observed_at date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sport_market_features_category_check check (
    feature_category in ('market', 'demand', 'supply', 'sentiment')
  )
);

create unique index sport_market_features_sport_key_date_unique
  on public.sport_market_features (sport_id, feature_key, observed_at);

create index sport_market_features_sport_observed_idx
  on public.sport_market_features (sport_id, observed_at desc);

create table public.sport_market_index_snapshots (
  id uuid primary key default gen_random_uuid(),
  sport_id text not null references public.sport_market_index_configs (id) on delete cascade,
  health_score smallint not null,
  momentum_score smallint not null,
  outlook_score smallint not null,
  forecast_3m_pct numeric not null,
  forecast_6m_pct numeric not null,
  forecast_12m_pct numeric not null,
  confidence_score smallint not null,
  risk_rating text not null,
  positive_drivers jsonb not null default '[]'::jsonb,
  negative_drivers jsonb not null default '[]'::jsonb,
  explanation text not null default '',
  feature_snapshot jsonb not null default '{}'::jsonb,
  model_version text not null default 'sport-index-v1.0.0',
  computed_at timestamptz not null default now(),
  constraint sport_market_index_snapshots_health_range check (
    health_score >= 0 and health_score <= 100
  ),
  constraint sport_market_index_snapshots_momentum_range check (
    momentum_score >= 0 and momentum_score <= 100
  ),
  constraint sport_market_index_snapshots_outlook_range check (
    outlook_score >= 0 and outlook_score <= 100
  ),
  constraint sport_market_index_snapshots_confidence_range check (
    confidence_score >= 0 and confidence_score <= 100
  ),
  constraint sport_market_index_snapshots_risk_rating_check check (
    risk_rating in ('low', 'medium', 'high')
  )
);

create index sport_market_index_snapshots_sport_computed_idx
  on public.sport_market_index_snapshots (sport_id, computed_at desc);

create table public.sport_market_index_cache (
  sport_id text primary key references public.sport_market_index_configs (id) on delete cascade,
  result jsonb not null,
  fetched_at timestamptz not null default now()
);

create index sport_market_index_cache_fetched_at_idx
  on public.sport_market_index_cache (fetched_at desc);

alter table public.sport_market_index_configs enable row level security;
alter table public.sport_market_features enable row level security;
alter table public.sport_market_index_snapshots enable row level security;
alter table public.sport_market_index_cache enable row level security;

create policy "Authenticated users can read active sport index configs"
  on public.sport_market_index_configs
  for select
  to authenticated
  using (active = true or public.is_admin());

create policy "Admins can manage sport index configs"
  on public.sport_market_index_configs
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Authenticated users can read sport market features"
  on public.sport_market_features
  for select
  to authenticated
  using (true);

create policy "Admins can manage sport market features"
  on public.sport_market_features
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Authenticated users can read sport index snapshots"
  on public.sport_market_index_snapshots
  for select
  to authenticated
  using (true);

create policy "Admins can insert sport index snapshots"
  on public.sport_market_index_snapshots
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Authenticated users can read sport index cache"
  on public.sport_market_index_cache
  for select
  to authenticated
  using (true);

create policy "Authenticated users can upsert sport index cache"
  on public.sport_market_index_cache
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update sport index cache"
  on public.sport_market_index_cache
  for update
  to authenticated
  using (true)
  with check (true);

insert into public.sport_market_index_configs (
  id,
  name,
  active,
  season_config,
  search_terms,
  provider_config,
  index_weights,
  forecast_config,
  season_modifiers,
  risk_thresholds,
  sort_order
) values (
  'nba',
  'NBA Basketball',
  true,
  '{
    "season_start": "10-01",
    "season_end": "06-30",
    "draft_date": "06-26",
    "playoffs_start": "04-15",
    "finals_end": "06-20"
  }'::jsonb,
  '{
    "default": ["NBA basketball cards", "Panini Prizm NBA"],
    "sentiment": ["NBA basketball cards", "basketball cards investment"],
    "reddit": ["basketballcards", "sportscards"],
    "trends": ["NBA cards", "basketball cards"]
  }'::jsonb,
  '{
    "enabled_providers": [
      "market-sentiment-composite",
      "ebay-market",
      "product-calendar"
    ]
  }'::jsonb,
  '{
    "health": {
      "market.ebay.transaction_count": 0.15,
      "market.ebay.dollar_volume": 0.12,
      "market.ebay.liquidity_index": 0.10,
      "sentiment.composite.score": 0.20,
      "demand.google.trends_index": 0.08,
      "supply.sealed.inventory_proxy": -0.10,
      "supply.product.release_pressure": -0.05
    },
    "momentum": {
      "market.ebay.transaction_count": 0.25,
      "sentiment.composite.score": 0.20,
      "demand.google.trends_index": 0.15,
      "sentiment.reddit.score": 0.10
    },
    "outlook_blend": {
      "health": 0.35,
      "momentum": 0.45,
      "leading_bundle": 0.20
    }
  }'::jsonb,
  '{
    "leading_indicator_features": [
      "sentiment.composite.score",
      "demand.google.trends_index",
      "market.ebay.transaction_count"
    ],
    "ensemble_weights": {
      "rules": 0.6,
      "ridge": 0.3,
      "gbm": 0.1
    },
    "rules_coefficients": {
      "outlook_to_3m": 0.25,
      "momentum_adj": 0.08,
      "horizon_6m_multiplier": 1.6,
      "horizon_12m_multiplier": 2.4,
      "decay_pull_strength": 0.35
    },
    "ridge_coefficients": {}
  }'::jsonb,
  '{
    "playoffs": { "momentum": 0.03 },
    "draft": { "demand.google.trends_index": 0.05 },
    "offseason": { "health": -0.02 }
  }'::jsonb,
  '{
    "low_confidence_min": 75,
    "medium_confidence_min": 50,
    "high_supply_headwind_count": 2
  }'::jsonb,
  1
);

notify pgrst, 'reload schema';
