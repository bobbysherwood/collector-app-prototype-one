-- Remaining unlinked cards after the main player backfill.
-- Run in the Supabase SQL editor. Paste both result grids.

set statement_timeout = '10min';

select * from (
  select 1 as sort, 'unlinked_cards' as metric, count(*)::bigint as n
  from public.dm2_cards c
  where not exists (select 1 from public.dm2_card_players cp where cp.card_id = c.id)
  union all
  select 2, 'unlinked_from_review_names', count(*)
  from public.dm2_cards c
  inner join public.dm2_card_sets cs on cs.id = c.card_set_id
  where not exists (select 1 from public.dm2_card_players cp where cp.card_id = c.id)
    and exists (
      select 1
      from public.dm2_player_backfill_candidates cand
      where cand.sport_id = cs.sport_id
        and (
          lower(trim(c.player)) = cand.name_key
          or cand.name_key = any (
            select lower(trim(part))
            from unnest(string_to_array(c.player, '/')) as part
          )
        )
        and not exists (
          select 1 from public.dm2_players p
          where p.sport_id = cand.sport_id and p.name_key = cand.name_key
        )
        and not exists (
          select 1 from public.dm2_player_aliases a
          where a.sport_id = cand.sport_id and a.name_key = cand.name_key
        )
    )
  union all
  select 3, 'candidates_still_missing', count(*)
  from public.dm2_player_backfill_candidates c
  where not exists (
    select 1 from public.dm2_players p
    where p.sport_id = c.sport_id and p.name_key = c.name_key
  )
    and not exists (
      select 1 from public.dm2_player_aliases a
      where a.sport_id = c.sport_id and a.name_key = c.name_key
    )
) summary
order by sort;

with named as (
  select sport_id, name_key from public.dm2_players
  union
  select sport_id, name_key from public.dm2_player_aliases
),
unmatched as (
  select
    sport.label as sport_label,
    trim(part) as name,
    lower(trim(part)) as name_key,
    c.id as card_id
  from public.dm2_cards c
  inner join public.dm2_card_sets cs on cs.id = c.card_set_id
  inner join public.pick_list_options sport
    on sport.id = cs.sport_id
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
group by sport_label, name_key
order by unlinked_cards desc, sport_label, name
limit 40;
