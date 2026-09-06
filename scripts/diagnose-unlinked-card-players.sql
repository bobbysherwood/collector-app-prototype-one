-- Why so many cards have no dm2_card_players row.
-- Run in the Supabase SQL editor. Paste both result grids.

set statement_timeout = '10min';

select * from (
  select 1 as sort, 'cards' as metric, count(*)::bigint as n from public.dm2_cards
  union all
  select 2, 'card_player_links', count(*) from public.dm2_card_players
  union all
  select 3, 'cards_linked', count(*) from public.dm2_cards c
    where exists (select 1 from public.dm2_card_players cp where cp.card_id = c.id)
  union all
  select 4, 'cards_unlinked', count(*) from public.dm2_cards c
    where not exists (select 1 from public.dm2_card_players cp where cp.card_id = c.id)
  union all
  select 5, 'players', count(*) from public.dm2_players
  union all
  select 6, 'aliases', count(*) from public.dm2_player_aliases
  union all
  select 7, 'candidates', count(*) from public.dm2_player_backfill_candidates
  union all
  select 8, 'candidates_missing_player', count(*)
  from public.dm2_player_backfill_candidates c
  where not exists (
    select 1 from public.dm2_players p
    where p.sport_id = c.sport_id and p.name_key = c.name_key
  )
    and not exists (
      select 1 from public.dm2_player_aliases a
      where a.sport_id = c.sport_id and a.name_key = c.name_key
    )
  union all
  select 9, 'unlinked_blank_player', count(*)
  from public.dm2_cards c
  where not exists (select 1 from public.dm2_card_players cp where cp.card_id = c.id)
    and length(trim(c.player)) = 0
  union all
  select 10, 'unlinked_name_exists_other_sport', count(distinct c.id)
  from public.dm2_cards c
  inner join public.dm2_card_sets cs on cs.id = c.card_set_id
  cross join lateral unnest(string_to_array(c.player, '/')) as part
  where not exists (select 1 from public.dm2_card_players cp where cp.card_id = c.id)
    and length(trim(part)) > 0
    and exists (
      select 1
      from public.dm2_players p
      where p.name_key = lower(trim(part))
        and p.sport_id <> cs.sport_id
    )
    and not exists (
      select 1
      from public.dm2_players p
      where p.name_key = lower(trim(part))
        and p.sport_id = cs.sport_id
    )
    and not exists (
      select 1
      from public.dm2_player_aliases a
      where a.name_key = lower(trim(part))
        and a.sport_id = cs.sport_id
    )
) summary
order by sort;

-- Top unmatched catalog spellings (exact name_key, same sport)
with named as (
  select sport_id, name_key from public.dm2_players
  union
  select sport_id, name_key from public.dm2_player_aliases
),
unmatched as (
  select
    cs.sport_id,
    sport.label as sport_label,
    trim(part) as name,
    lower(trim(part)) as name_key,
    c.id as card_id
  from public.dm2_cards c
  inner join public.dm2_card_sets cs on cs.id = c.card_set_id
  inner join public.pick_list_options sport
    on sport.id = cs.sport_id
    and sport.category = 'sport'
  cross join lateral unnest(string_to_array(c.player, '/')) as part
  where not exists (select 1 from public.dm2_card_players cp where cp.card_id = c.id)
    and length(trim(part)) > 0
    and not exists (
      select 1 from named n
      where n.sport_id = cs.sport_id
        and n.name_key = lower(trim(part))
    )
)
select
  sport_label,
  (array_agg(name order by length(name) desc, name))[1] as name,
  name_key,
  count(distinct card_id) as unlinked_cards
from unmatched
group by sport_id, sport_label, name_key
order by unlinked_cards desc, sport_label, name
limit 40;
