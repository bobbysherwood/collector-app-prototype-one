-- Paginated DM2 card search with total match count for Market Research.

drop function if exists public.search_dm2_cards(text, int);
drop function if exists public.search_dm2_cards(text, int, int);

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
language sql
security definer
set search_path = ''
as $$
  with tokens as (
    select token
    from unnest(string_to_array(lower(trim(query)), ' ')) as token
    where token <> ''
  ),
  haystack as (
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
      p.name as parallel,
      c.image_path,
      (
        select coalesce(array_agg(a.name order by a.name), '{}'::text[])
        from public.dm2_card_attributes ca
        inner join public.dm2_attributes a on a.id = ca.attribute_id
        where ca.card_id = c.id
          and a.active = true
      ) as attribute_names,
      lower(
        sport.label || ' ' || cs.year::text || ' ' || m.name || ' ' ||
        b.name || ' ' || csc.name || ' ' || csn.name || ' ' ||
        c.card_number || ' ' || c.player || ' ' || coalesce(p.name, '')
      ) as search_text,
      lower(c.player) as player_key
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
  ),
  matched as (
    select h.*
    from haystack h
    where auth.uid() is not null
      and length(trim(query)) >= 2
      and (select count(*) from tokens) > 0
      and (
        not exists (
          select 1
          from tokens t
          where strpos(h.search_text, t.token) = 0
        )
        or not exists (
          select 1
          from tokens t
          where strpos(h.player_key, t.token) = 0
        )
      )
  )
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
    m.player,
    m.parallel,
    m.image_path,
    m.attribute_names,
    count(*) over() as total_count
  from matched m
  order by
    case
      when not exists (
        select 1
        from tokens t
        where strpos(m.player_key, t.token) = 0
      ) then 0
      else 1
    end,
    m.year desc,
    m.player asc,
    m.card_set_name asc,
    m.card_number asc
  limit least(greatest(coalesce(lim, 24), 1), 100)
  offset greatest(coalesce(row_offset, 0), 0);
$$;

revoke all on function public.search_dm2_cards(text, int, int) from public;
grant execute on function public.search_dm2_cards(text, int, int) to authenticated;

notify pgrst, 'reload schema';
