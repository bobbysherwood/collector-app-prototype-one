-- Page get_dm2_cards_for_player before formatting names/attributes.
-- The previous CTE formatted every linked card, then applied LIMIT, so large
-- players (e.g. LeBron, ~8k cards) hit the statement timeout and the page
-- showed zero cards.

create or replace function public.get_dm2_cards_for_player(
  p_player_id uuid,
  lim int default 24,
  row_offset int default 0
)
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
  parallel text,
  image_path text,
  attribute_names text[],
  total_count bigint
)
language sql
security definer
set search_path = ''
as $$
  with bounds as (
    select
      least(greatest(coalesce(lim, 24), 1), 100) as page_size,
      greatest(coalesce(row_offset, 0), 0) as page_offset
  ),
  ranked as (
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
      p.name as parallel,
      c.image_path
    from public.dm2_card_players cp
    inner join public.dm2_cards c on c.id = cp.card_id
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    inner join public.pick_list_options sport on sport.id = cs.sport_id
    inner join public.dm2_brands b on b.id = cs.brand_id
    inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
    inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
    inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
    left join public.dm2_parallels p on p.id = c.parallel_id
    where auth.uid() is not null
      and cp.player_id = p_player_id
      and c.active = true
      and cs.active = true
    order by cs.year desc, csn.name asc, c.card_number asc, c.id asc
    limit (select page_size from bounds)
    offset (select page_offset from bounds)
  ),
  total as (
    select count(*)::bigint as total_count
    from public.dm2_card_players cp
    inner join public.dm2_cards c on c.id = cp.card_id
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    where auth.uid() is not null
      and cp.player_id = p_player_id
      and c.active = true
      and cs.active = true
  )
  select
    r.id,
    r.card_set_id,
    r.sport,
    r.year,
    r.manufacturer,
    r.brand,
    r.card_set_category,
    r.card_set_name,
    r.card_number,
    public.dm2_format_card_players(r.id) as player,
    r.parallel,
    r.image_path,
    (
      select coalesce(array_agg(a.name order by a.name), '{}'::text[])
      from public.dm2_card_attributes ca
      inner join public.dm2_attributes a on a.id = ca.attribute_id
      where ca.card_id = r.id
        and a.active = true
    ) as attribute_names,
    t.total_count
  from ranked r
  cross join total t;
$$;

revoke all on function public.get_dm2_cards_for_player(uuid, int, int) from public;
grant execute on function public.get_dm2_cards_for_player(uuid, int, int) to authenticated;

notify pgrst, 'reload schema';
