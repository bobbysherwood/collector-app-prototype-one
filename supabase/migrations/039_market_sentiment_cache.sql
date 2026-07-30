-- Cached market sentiment analysis results (24h rolling TTL)

create table public.market_sentiment_cache (
  card_id uuid primary key,
  result jsonb not null,
  input jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create index market_sentiment_cache_fetched_at_idx
  on public.market_sentiment_cache (fetched_at desc);

alter table public.market_sentiment_cache enable row level security;

create policy "Authenticated users can read market sentiment cache"
  on public.market_sentiment_cache
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert market sentiment cache"
  on public.market_sentiment_cache
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update market sentiment cache"
  on public.market_sentiment_cache
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete market sentiment cache"
  on public.market_sentiment_cache
  for delete
  to authenticated
  using (true);
