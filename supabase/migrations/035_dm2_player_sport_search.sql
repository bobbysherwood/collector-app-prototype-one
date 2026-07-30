-- DM2 player and sport search for market research

create or replace function public.search_dm2_players(
  query text,
  lim int default 50
)
returns table (
  player text,
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
  )
  select
    c.player,
    count(*)::bigint as card_count
  from public.dm2_cards c
  inner join public.dm2_card_sets cs on cs.id = c.card_set_id
  where auth.uid() is not null
    and length(trim(query)) >= 2
    and (select count(*) from tokens) > 0
    and c.active = true
    and cs.active = true
    and not exists (
      select 1
      from tokens t
      where strpos(lower(c.player), t.token) = 0
    )
  group by c.player
  order by c.player asc
  limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

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
  )
  select
    sport.label as sport,
    count(distinct cs.id)::bigint as card_set_count,
    count(c.id)::bigint as card_count
  from public.dm2_card_sets cs
  inner join public.pick_list_options sport on sport.id = cs.sport_id
  inner join public.dm2_cards c on c.card_set_id = cs.id
  where auth.uid() is not null
    and length(trim(query)) >= 2
    and (select count(*) from tokens) > 0
    and cs.active = true
    and c.active = true
    and not exists (
      select 1
      from tokens t
      where strpos(lower(sport.label), t.token) = 0
    )
  group by sport.label
  order by sport.label asc
  limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

revoke all on function public.search_dm2_players(text, int) from public;
grant execute on function public.search_dm2_players(text, int) to authenticated;

revoke all on function public.search_dm2_sports(text, int) from public;
grant execute on function public.search_dm2_sports(text, int) to authenticated;
