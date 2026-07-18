-- Remove Card Set Name linkage from Brand

drop index if exists public.dm2_brands_card_set_name_id_idx;

alter table public.dm2_brands
  drop constraint if exists dm2_brands_card_set_name_id_fkey;

alter table public.dm2_brands
  drop column if exists card_set_name_id;
