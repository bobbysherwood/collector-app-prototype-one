-- Cached eBay Browse API listings per asset (24h refresh on card page load)

create table if not exists public.ebay_listings_cache (
  asset_id uuid primary key references public.assets (id) on delete cascade,
  listings jsonb not null default '[]'::jsonb,
  search_query text not null default '',
  result_count int not null default 0,
  fetched_at timestamptz not null default now()
);

create index if not exists ebay_listings_cache_fetched_at_idx
  on public.ebay_listings_cache (fetched_at desc);

alter table public.ebay_listings_cache enable row level security;

create policy "Users can read ebay listings cache for own assets"
  on public.ebay_listings_cache
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assets
      where assets.id = ebay_listings_cache.asset_id
        and assets.user_id = auth.uid()
    )
  );

create policy "Users can insert ebay listings cache for own assets"
  on public.ebay_listings_cache
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.assets
      where assets.id = ebay_listings_cache.asset_id
        and assets.user_id = auth.uid()
    )
  );

create policy "Users can update ebay listings cache for own assets"
  on public.ebay_listings_cache
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.assets
      where assets.id = ebay_listings_cache.asset_id
        and assets.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.assets
      where assets.id = ebay_listings_cache.asset_id
        and assets.user_id = auth.uid()
    )
  );

create policy "Users can delete ebay listings cache for own assets"
  on public.ebay_listings_cache
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.assets
      where assets.id = ebay_listings_cache.asset_id
        and assets.user_id = auth.uid()
    )
  );
