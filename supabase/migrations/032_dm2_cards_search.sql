-- Search DM2 cards for authenticated users (add-asset flow)

create or replace function public.search_dm2_cards(
  query text,
  lim int default 20
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
  parallel text
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
      lower(
        sport.label || ' ' || cs.year::text || ' ' || m.name || ' ' ||
        b.name || ' ' || csc.name || ' ' || csn.name || ' ' ||
        c.card_number || ' ' || c.player || ' ' || coalesce(p.name, '')
      ) as search_text
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
  )
  select
    h.id,
    h.card_set_id,
    h.sport,
    h.year,
    h.manufacturer,
    h.brand,
    h.card_set_category,
    h.card_set_name,
    h.card_number,
    h.player,
    h.parallel
  from haystack h
  where auth.uid() is not null
    and length(trim(query)) >= 2
    and (select count(*) from tokens) > 0
    and not exists (
      select 1
      from tokens t
      where strpos(h.search_text, t.token) = 0
    )
  order by h.year desc, h.card_set_name asc, h.player asc, h.card_number asc
  limit least(greatest(coalesce(lim, 20), 1), 50);
$$;

revoke all on function public.search_dm2_cards(text, int) from public;
grant execute on function public.search_dm2_cards(text, int) to authenticated;
