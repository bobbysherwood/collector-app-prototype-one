-- Track sold status on cards
alter table public.cards
  add column if not exists status text not null default 'held'
    check (status in ('held', 'sold')),
  add column if not exists sold_at date,
  add column if not exists sold_price numeric(12, 2)
    check (sold_price is null or sold_price >= 0);

create index if not exists cards_status_idx on public.cards (status);

alter table public.cards drop constraint if exists cards_sold_fields_check;
alter table public.cards add constraint cards_sold_fields_check
  check (
    (status = 'held' and sold_at is null and sold_price is null)
    or (status = 'sold' and sold_at is not null and sold_price is not null)
  );
