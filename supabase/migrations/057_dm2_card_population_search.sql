-- Faster Card Population admin search: trigram indexes on the small lookup tables
-- used to narrow cards. Does not change Market Research search_dm2_cards.

create extension if not exists pg_trgm;

create index if not exists dm2_players_name_trgm_idx
  on public.dm2_players using gin (lower(name) gin_trgm_ops);

create index if not exists dm2_card_set_names_name_trgm_idx
  on public.dm2_card_set_names using gin (lower(name) gin_trgm_ops);

create index if not exists dm2_parallels_name_trgm_idx
  on public.dm2_parallels using gin (lower(name) gin_trgm_ops);

create index if not exists dm2_brands_name_trgm_idx
  on public.dm2_brands using gin (lower(name) gin_trgm_ops);

create index if not exists dm2_manufacturers_name_trgm_idx
  on public.dm2_manufacturers using gin (lower(name) gin_trgm_ops);

create index if not exists dm2_card_set_categories_name_trgm_idx
  on public.dm2_card_set_categories using gin (lower(name) gin_trgm_ops);

create index if not exists dm2_card_sets_year_active_idx
  on public.dm2_card_sets (year)
  where active = true;
