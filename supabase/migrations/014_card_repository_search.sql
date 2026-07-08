-- Search card repository for authenticated users (add-asset flow)

create or replace function public.search_card_repository(
  query text,
  lim int default 20
)
returns table (
  id uuid,
  category text,
  year smallint,
  manufacturer text,
  brand text,
  card_set_category text,
  card_set text,
  card_number text,
  player text,
  parallel text,
  serial_number smallint,
  release_date date
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
      cr.id,
      cr.category,
      cr.year,
      cr.manufacturer,
      cr.brand,
      cr.card_set_category,
      cr.card_set,
      cr.card_number,
      cr.player,
      cr.parallel,
      cr.serial_number,
      cr.release_date,
      lower(
        cr.category || ' ' || cr.year::text || ' ' || cr.manufacturer || ' ' ||
        cr.brand || ' ' || cr.card_set_category || ' ' || cr.card_set || ' ' ||
        cr.card_number || ' ' || cr.player || ' ' || coalesce(cr.parallel, '')
      ) as search_text
    from public.card_repository cr
  )
  select
    h.id,
    h.category,
    h.year,
    h.manufacturer,
    h.brand,
    h.card_set_category,
    h.card_set,
    h.card_number,
    h.player,
    h.parallel,
    h.serial_number,
    h.release_date
  from haystack h
  where auth.uid() is not null
    and length(trim(query)) >= 2
    and (select count(*) from tokens) > 0
    and not exists (
      select 1
      from tokens t
      where strpos(h.search_text, t.token) = 0
    )
  order by h.year desc, h.card_set asc, h.player asc, h.card_number asc
  limit least(greatest(coalesce(lim, 20), 1), 50);
$$;

revoke all on function public.search_card_repository(text, int) from public;
grant execute on function public.search_card_repository(text, int) to authenticated;
