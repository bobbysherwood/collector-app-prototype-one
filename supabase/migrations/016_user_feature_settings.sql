-- Per-user feature toggles (replaces app-wide app_settings)

create table public.user_feature_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  portfolio_insights_enabled boolean not null default true,
  market_research_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_feature_settings enable row level security;

create policy "Users can read own feature settings"
  on public.user_feature_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can read all feature settings"
  on public.user_feature_settings
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert feature settings"
  on public.user_feature_settings
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update feature settings"
  on public.user_feature_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop table if exists public.app_settings;
