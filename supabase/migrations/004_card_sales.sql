-- Record card sales for portfolio activity tracking
create table public.card_sales (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.cards on delete set null,
  user_id uuid references auth.users on delete cascade not null,
  sale_date date not null,
  sale_price numeric(12, 2) not null check (sale_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

create index card_sales_user_id_idx on public.card_sales (user_id);
create index card_sales_sale_date_idx on public.card_sales (sale_date);
create index card_sales_card_id_idx on public.card_sales (card_id);

alter table public.card_sales enable row level security;

create policy "Users can view own card sales"
  on public.card_sales for select
  using (auth.uid() = user_id);

create policy "Users can insert own card sales"
  on public.card_sales for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own card sales"
  on public.card_sales for delete
  using (auth.uid() = user_id);
