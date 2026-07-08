-- App-wide AI feature toggles (admin-managed)

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  portfolio_insights_enabled boolean not null default true,
  market_research_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1);

alter table public.app_settings enable row level security;

create policy "Authenticated users can read app settings"
  on public.app_settings
  for select
  to authenticated
  using (true);

create policy "Admins can update app settings"
  on public.app_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
