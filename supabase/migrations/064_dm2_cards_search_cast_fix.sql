-- 062 is already applied in production, but plpgsql RETURN QUERY rejected
-- varchar card_number (and related text columns) against RETURNS TABLE text.
-- Re-replace the function with explicit casts. Then Settings → API → reload schema.

create or replace function public.search_dm2_cards(
  query text,
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  page_size int := least(greatest(coalesce(lim, 24), 1), 100);
  page_offset int := greatest(coalesce(row_offset, 0), 0);
  exact_player_count int := 0;
  partial_player_count int := 0;
begin
  if auth.uid() is null or length(trim(coalesce(query, ''))) < 2 then
    return;
  end if;

  select count(*)
  into exact_player_count
  from (
    select pl.id
    from public.dm2_players pl
    where pl.active = true
      and not exists (
        select 1
        from unnest(string_to_array(lower(trim(query)), ' ')) as token
        where token <> ''
          and strpos(lower(pl.name), token) = 0
      )
    union
    select a.player_id
    from public.dm2_player_aliases a
    inner join public.dm2_players pl on pl.id = a.player_id and pl.active = true
    where not exists (
      select 1
      from unnest(string_to_array(lower(trim(query)), ' ')) as token
      where token <> ''
        and strpos(lower(a.name), token) = 0
    )
  ) exact_players;

  if exact_player_count > 0 then
    return query
    with tokens as (
      select token
      from unnest(string_to_array(lower(trim(query)), ' ')) as token
      where token <> ''
    ),
    exact_players as (
      select pl.id
      from public.dm2_players pl
      where pl.active = true
        and not exists (
          select 1 from tokens t where strpos(lower(pl.name), t.token) = 0
        )
      union
      select a.player_id
      from public.dm2_player_aliases a
      inner join public.dm2_players pl on pl.id = a.player_id and pl.active = true
      where not exists (
        select 1 from tokens t where strpos(lower(a.name), t.token) = 0
      )
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
      from public.dm2_cards c
      inner join public.dm2_card_sets cs on cs.id = c.card_set_id
      inner join public.pick_list_options sport on sport.id = cs.sport_id
      inner join public.dm2_brands b on b.id = cs.brand_id
      inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
      inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
      inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
      left join public.dm2_parallels p on p.id = c.parallel_id
      where c.active = true
        and cs.active = true
        and exists (
          select 1
          from public.dm2_card_players cp
          inner join exact_players ep on ep.id = cp.player_id
          where cp.card_id = c.id
        )
      order by cs.year desc, csn.name asc, c.card_number asc, c.id asc
      limit page_size
      offset page_offset
    ),
    total as (
      select count(distinct c.id)::bigint as total_count
      from public.dm2_card_players cp
      inner join exact_players ep on ep.id = cp.player_id
      inner join public.dm2_cards c on c.id = cp.card_id
      inner join public.dm2_card_sets cs on cs.id = c.card_set_id
      where c.active = true
        and cs.active = true
    )
    select
      r.id,
      r.card_set_id,
      r.sport::text,
      r.year::smallint,
      r.manufacturer::text,
      r.brand::text,
      r.card_set_category::text,
      r.card_set_name::text,
      r.card_number::text,
      public.dm2_format_card_players(r.id)::text,
      r.parallel::text,
      r.image_path::text,
      (
        select coalesce(array_agg(a.name::text order by a.name), '{}'::text[])
        from public.dm2_card_attributes ca
        inner join public.dm2_attributes a on a.id = ca.attribute_id
        where ca.card_id = r.id
          and a.active = true
      ),
      t.total_count::bigint
    from ranked r
    cross join total t;
    return;
  end if;

  select count(*)
  into partial_player_count
  from (
    select pl.id
    from public.dm2_players pl
    where pl.active = true
      and exists (
        select 1
        from unnest(string_to_array(lower(trim(query)), ' ')) as token
        where token <> ''
          and strpos(lower(pl.name), token) > 0
      )
    union
    select a.player_id
    from public.dm2_player_aliases a
    inner join public.dm2_players pl on pl.id = a.player_id and pl.active = true
    where exists (
      select 1
      from unnest(string_to_array(lower(trim(query)), ' ')) as token
      where token <> ''
        and strpos(lower(a.name), token) > 0
    )
  ) partial_players;

  if partial_player_count > 0 then
    return query
    with tokens as (
      select token
      from unnest(string_to_array(lower(trim(query)), ' ')) as token
      where token <> ''
    ),
    partial_players as (
      select pl.id
      from public.dm2_players pl
      where pl.active = true
        and exists (
          select 1 from tokens t where strpos(lower(pl.name), t.token) > 0
        )
      union
      select a.player_id
      from public.dm2_player_aliases a
      inner join public.dm2_players pl on pl.id = a.player_id and pl.active = true
      where exists (
        select 1 from tokens t where strpos(lower(a.name), t.token) > 0
      )
    ),
    candidates as (
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
        c.image_path,
        lower(
          sport.label || ' ' || cs.year::text || ' ' || m.name || ' ' ||
          b.name || ' ' || csc.name || ' ' || csn.name || ' ' ||
          c.card_number || ' ' || coalesce(p.name, '')
        ) as set_text
      from public.dm2_card_players cp
      inner join partial_players pp on pp.id = cp.player_id
      inner join public.dm2_cards c on c.id = cp.card_id
      inner join public.dm2_card_sets cs on cs.id = c.card_set_id
      inner join public.pick_list_options sport on sport.id = cs.sport_id
      inner join public.dm2_brands b on b.id = cs.brand_id
      inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
      inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
      inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
      left join public.dm2_parallels p on p.id = c.parallel_id
      where c.active = true
        and cs.active = true
      group by
        c.id,
        c.card_set_id,
        sport.label,
        cs.year,
        m.name,
        b.name,
        csc.name,
        csn.name,
        c.card_number,
        p.name,
        c.image_path
    ),
    matched as (
      select cand.*
      from candidates cand
      where not exists (
        select 1
        from tokens t
        where strpos(cand.set_text, t.token) = 0
          and not exists (
            select 1
            from public.dm2_card_players cp2
            inner join public.dm2_players pl2
              on pl2.id = cp2.player_id
             and pl2.active = true
            where cp2.card_id = cand.id
              and strpos(lower(pl2.name), t.token) > 0
          )
      )
    ),
    ranked as (
      select
        m.id,
        m.card_set_id,
        m.sport,
        m.year,
        m.manufacturer,
        m.brand,
        m.card_set_category,
        m.card_set_name,
        m.card_number,
        m.parallel,
        m.image_path
      from matched m
      order by m.year desc, m.card_set_name asc, m.card_number asc, m.id asc
      limit page_size
      offset page_offset
    ),
    total as (
      select count(*)::bigint as total_count from matched
    )
    select
      r.id,
      r.card_set_id,
      r.sport::text,
      r.year::smallint,
      r.manufacturer::text,
      r.brand::text,
      r.card_set_category::text,
      r.card_set_name::text,
      r.card_number::text,
      public.dm2_format_card_players(r.id)::text,
      r.parallel::text,
      r.image_path::text,
      (
        select coalesce(array_agg(a.name::text order by a.name), '{}'::text[])
        from public.dm2_card_attributes ca
        inner join public.dm2_attributes a on a.id = ca.attribute_id
        where ca.card_id = r.id
          and a.active = true
      ),
      t.total_count::bigint
    from ranked r
    cross join total t;
    return;
  end if;

  return query
  with tokens as (
    select token
    from unnest(string_to_array(lower(trim(query)), ' ')) as token
    where token <> ''
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
    from public.dm2_cards c
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    inner join public.pick_list_options sport on sport.id = cs.sport_id
    inner join public.dm2_brands b on b.id = cs.brand_id
    inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
    inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
    inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
    left join public.dm2_parallels p on p.id = c.parallel_id
    where c.active = true
      and cs.active = true
      and not exists (
        select 1
        from tokens t
        where strpos(
          lower(
            sport.label || ' ' || cs.year::text || ' ' || m.name || ' ' ||
            b.name || ' ' || csc.name || ' ' || csn.name || ' ' ||
            c.card_number || ' ' || coalesce(p.name, '')
          ),
          t.token
        ) = 0
      )
    order by cs.year desc, csn.name asc, c.card_number asc, c.id asc
    limit page_size
    offset page_offset
  ),
  total as (
    select count(*)::bigint as total_count
    from public.dm2_cards c
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    inner join public.pick_list_options sport on sport.id = cs.sport_id
    inner join public.dm2_brands b on b.id = cs.brand_id
    inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
    inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
    inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
    left join public.dm2_parallels p on p.id = c.parallel_id
    where c.active = true
      and cs.active = true
      and not exists (
        select 1
        from tokens t
        where strpos(
          lower(
            sport.label || ' ' || cs.year::text || ' ' || m.name || ' ' ||
            b.name || ' ' || csc.name || ' ' || csn.name || ' ' ||
            c.card_number || ' ' || coalesce(p.name, '')
          ),
          t.token
        ) = 0
      )
  )
  select
    r.id,
    r.card_set_id,
    r.sport::text,
    r.year::smallint,
    r.manufacturer::text,
    r.brand::text,
    r.card_set_category::text,
    r.card_set_name::text,
    r.card_number::text,
    public.dm2_format_card_players(r.id)::text,
    r.parallel::text,
    r.image_path::text,
    (
      select coalesce(array_agg(a.name::text order by a.name), '{}'::text[])
      from public.dm2_card_attributes ca
      inner join public.dm2_attributes a on a.id = ca.attribute_id
      where ca.card_id = r.id
        and a.active = true
    ),
    t.total_count::bigint
  from ranked r
  cross join total t;
end;
$$;

revoke all on function public.search_dm2_cards(text, int, int) from public;
grant execute on function public.search_dm2_cards(text, int, int) to authenticated;

notify pgrst, 'reload schema';
