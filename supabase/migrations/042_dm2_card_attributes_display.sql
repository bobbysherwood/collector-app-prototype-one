-- Include DM2 card attributes in search/detail RPCs and support holdings lookup

drop function if exists public.search_dm2_cards(text, int);
drop function if exists public.get_dm2_card_by_id(uuid);

create or replace function public.search_dm2_cards(
  query text,
  lim int default 50
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
  attribute_names text[]
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
    h.parallel,
    h.image_path,
    h.attribute_names
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
  order by
    case
      when not exists (
        select 1
        from tokens t
        where strpos(h.player_key, t.token) = 0
      ) then 0
      else 1
    end,
    h.year desc,
    h.player asc,
    h.card_set_name asc,
    h.card_number asc
  limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

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
  parallel text,
  image_path text,
  attribute_names text[]
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
    p.name as parallel,
    c.image_path,
    (
      select coalesce(array_agg(a.name order by a.name), '{}'::text[])
      from public.dm2_card_attributes ca
      inner join public.dm2_attributes a on a.id = ca.attribute_id
      where ca.card_id = c.id
        and a.active = true
    ) as attribute_names
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

revoke all on function public.search_dm2_cards(text, int) from public;
grant execute on function public.search_dm2_cards(text, int) to authenticated;

revoke all on function public.get_dm2_card_by_id(uuid) from public;
grant execute on function public.get_dm2_card_by_id(uuid) to authenticated;

create or replace function public.lookup_dm2_card_attributes_batch(requests jsonb)
returns table (
  asset_id uuid,
  attribute_names text[]
)
language sql
security definer
set search_path = ''
as $$
  with input_rows as (
    select
      nullif(trim(entry ->> 'asset_id'), '')::uuid as asset_id,
      trim(entry ->> 'player') as player,
      trim(entry ->> 'card_number') as card_number,
      trim(entry ->> 'sport') as sport,
      nullif(entry ->> 'year', '')::smallint as year,
      trim(entry ->> 'brand') as brand,
      trim(entry ->> 'manufacturer') as manufacturer,
      trim(entry ->> 'card_set_category') as card_set_category,
      trim(entry ->> 'card_set_name') as card_set_name,
      trim(coalesce(entry ->> 'parallel', '')) as parallel
    from jsonb_array_elements(coalesce(requests, '[]'::jsonb)) as entry
  )
  select
    input_rows.asset_id,
    coalesce(
      (
        select array_agg(a.name order by a.name)
        from public.dm2_cards c
        inner join public.dm2_card_sets cs on cs.id = c.card_set_id
        inner join public.pick_list_options sport on sport.id = cs.sport_id
        inner join public.dm2_brands b on b.id = cs.brand_id
        inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
        inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
        inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
        left join public.dm2_parallels p on p.id = c.parallel_id
        inner join public.dm2_card_attributes ca on ca.card_id = c.id
        inner join public.dm2_attributes a on a.id = ca.attribute_id
        where c.active = true
          and cs.active = true
          and a.active = true
          and input_rows.asset_id is not null
          and lower(trim(c.player)) = lower(input_rows.player)
          and lower(trim(c.card_number)) = lower(input_rows.card_number)
          and lower(trim(sport.label)) = lower(input_rows.sport)
          and cs.year = input_rows.year
          and lower(trim(b.name)) = lower(input_rows.brand)
          and lower(trim(m.name)) = lower(input_rows.manufacturer)
          and lower(trim(csc.name)) = lower(input_rows.card_set_category)
          and lower(trim(csn.name)) = lower(input_rows.card_set_name)
          and coalesce(lower(trim(p.name)), '') = lower(input_rows.parallel)
      ),
      '{}'::text[]
    ) as attribute_names
  from input_rows
  where auth.uid() is not null
    and input_rows.asset_id is not null;
$$;

revoke all on function public.lookup_dm2_card_attributes_batch(jsonb) from public;
grant execute on function public.lookup_dm2_card_attributes_batch(jsonb) to authenticated;
