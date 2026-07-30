-- Return individual players (not compound card player strings) for market research search.
-- Splits multi-player values on "/" and dedupes by normalized name.
-- When the query exactly matches one player, return only that player.

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
  ),
  card_players as (
    select
      c.id as card_id,
      trim(part) as player_part,
      lower(trim(part)) as player_key
    from public.dm2_cards c
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    cross join lateral unnest(string_to_array(c.player, '/')) as part
    where auth.uid() is not null
      and length(trim(query)) >= 2
      and (select count(*) from tokens) > 0
      and c.active = true
      and cs.active = true
      and length(trim(part)) > 0
  ),
  player_names as (
    select distinct on (cp.player_key)
      cp.player_key,
      cp.player_part as player
    from card_players cp
    order by cp.player_key, length(cp.player_part) desc, cp.player_part asc
  ),
  matched as (
    select
      pn.player,
      pn.player_key,
      count(distinct cp.card_id)::bigint as card_count
    from player_names pn
    inner join card_players cp on cp.player_key = pn.player_key
    where not exists (
      select 1
      from tokens t
      where strpos(pn.player_key, t.token) = 0
    )
    group by pn.player, pn.player_key
  ),
  exact_key as (
    select lower(trim(query)) as player_key
  ),
  has_exact as (
    select exists (
      select 1
      from matched m
      inner join exact_key e on m.player_key = e.player_key
    ) as found
  )
  select
    m.player,
    m.card_count
  from matched m
  cross join has_exact h
  where (h.found and m.player_key = (select player_key from exact_key))
     or (not h.found)
  order by
    case when m.player_key = (select player_key from exact_key) then 0 else 1 end,
    m.card_count desc,
    m.player asc
  limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

revoke all on function public.search_dm2_players(text, int) from public;
grant execute on function public.search_dm2_players(text, int) to authenticated;
