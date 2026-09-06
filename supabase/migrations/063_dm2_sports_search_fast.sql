-- Sport search was joining every catalog card to count matches, so a query
-- like "basketball" hit the statement timeout. Filter sports first, then count
-- sets/cards by sport_id. Also page sport-catalog cards before formatting.

create or replace function public.search_dm2_sports(
  query text,
  lim int default 50
)
returns table (
  sport text,
  card_set_count bigint,
  card_count bigint
)
language sql
security definer
set search_path = ''
as $$
  with tokens as (
    select token
    from unnest(string_to_array(lower(trim(query)), ' ')) as token
    where token <> ''
  ),
  matched_sports as (
    select sport.id, sport.label
    from public.pick_list_options sport
    where auth.uid() is not null
      and length(trim(query)) >= 2
      and (select count(*) from tokens) > 0
      and sport.category = 'sport'
      and sport.active = true
      and not exists (
        select 1
        from tokens t
        where strpos(lower(sport.label), t.token) = 0
      )
  ),
  set_counts as (
    select
      cs.sport_id,
      count(*)::bigint as card_set_count
    from public.dm2_card_sets cs
    where cs.active = true
      and cs.sport_id in (select id from matched_sports)
    group by cs.sport_id
  ),
  card_counts as (
    select
      cs.sport_id,
      count(*)::bigint as card_count
    from public.dm2_card_sets cs
    inner join public.dm2_cards c on c.card_set_id = cs.id
    where cs.active = true
      and c.active = true
      and cs.sport_id in (select id from matched_sports)
    group by cs.sport_id
  )
  select
    s.label as sport,
    coalesce(sc.card_set_count, 0)::bigint as card_set_count,
    coalesce(cc.card_count, 0)::bigint as card_count
  from matched_sports s
  left join set_counts sc on sc.sport_id = s.id
  left join card_counts cc on cc.sport_id = s.id
  order by s.label asc
  limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

revoke all on function public.search_dm2_sports(text, int) from public;
grant execute on function public.search_dm2_sports(text, int) to authenticated;

create or replace function public.get_dm2_cards_for_sport(
  p_sport_id uuid,
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
    from public.dm2_card_sets cs
    inner join public.pick_list_options sport on sport.id = cs.sport_id
    inner join public.dm2_cards c on c.card_set_id = cs.id
    inner join public.dm2_brands b on b.id = cs.brand_id
    inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
    inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
    inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
    left join public.dm2_parallels p on p.id = c.parallel_id
    where auth.uid() is not null
      and cs.sport_id = p_sport_id
      and c.active = true
      and cs.active = true
    order by cs.year desc, csn.name asc, c.card_number asc, c.id asc
    limit (select page_size from bounds)
    offset (select page_offset from bounds)
  ),
  total as (
    select count(*)::bigint as total_count
    from public.dm2_cards c
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    where auth.uid() is not null
      and cs.sport_id = p_sport_id
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

revoke all on function public.get_dm2_cards_for_sport(uuid, int, int) from public;
grant execute on function public.get_dm2_cards_for_sport(uuid, int, int) to authenticated;

notify pgrst, 'reload schema';
