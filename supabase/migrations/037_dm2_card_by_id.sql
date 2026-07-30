-- Fetch a single DM2 card for market research detail view

create or replace function public.get_dm2_card_by_id(card_id uuid)
returns table (
  id uuid,
  card_set_id uuid,
  sport text,
  year smallint,
  manufacturer text,
  brand text,
  card_set_category text,
  card_set_name text,
  card_number text,
  player text,
  parallel text
)
language sql
security definer
set search_path = ''
as $$
  select
    c.id,
    c.card_set_id,
    sport.label as sport,
    cs.year,
    m.name as manufacturer,
    b.name as brand,
    csc.name as card_set_category,
    csn.name as card_set_name,
    c.card_number,
    c.player,
    p.name as parallel
  from public.dm2_cards c
  inner join public.dm2_card_sets cs on cs.id = c.card_set_id
  inner join public.pick_list_options sport on sport.id = cs.sport_id
  inner join public.dm2_brands b on b.id = cs.brand_id
  inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
  inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
  inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
  left join public.dm2_parallels p on p.id = c.parallel_id
  where auth.uid() is not null
    and c.id = card_id
    and c.active = true
    and cs.active = true
  limit 1;
$$;

revoke all on function public.get_dm2_card_by_id(uuid) from public;
grant execute on function public.get_dm2_card_by_id(uuid) to authenticated;
