-- Cached AI-generated portfolio insights per user

create table public.portfolio_insights_cache (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  snapshot_hash text not null,
  prompt_version text not null default 'insights-v1',
  insights jsonb not null,
  summary text,
  model text,
  generated_at timestamptz not null default now(),
  generated_for_login_at timestamptz,
  input_tokens int,
  output_tokens int
);

alter table public.portfolio_insights_cache enable row level security;

create policy "Users can read own portfolio insights cache"
  on public.portfolio_insights_cache
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own portfolio insights cache"
  on public.portfolio_insights_cache
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own portfolio insights cache"
  on public.portfolio_insights_cache
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own portfolio insights cache"
  on public.portfolio_insights_cache
  for delete
  to authenticated
  using (auth.uid() = user_id);
