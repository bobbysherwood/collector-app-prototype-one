-- Historical current-value entries per card (append-only for charting)
create table public.card_valuations (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.cards on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  value numeric(12, 2) not null check (value >= 0),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index card_valuations_card_id_idx on public.card_valuations (card_id);
create index card_valuations_card_recorded_idx
  on public.card_valuations (card_id, recorded_at desc);
create index card_valuations_user_id_idx on public.card_valuations (user_id);

alter table public.card_valuations enable row level security;

create policy "Users can view own card valuations"
  on public.card_valuations for select
  using (auth.uid() = user_id);

create policy "Users can insert own card valuations"
  on public.card_valuations for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own card valuations"
  on public.card_valuations for delete
  using (auth.uid() = user_id);
