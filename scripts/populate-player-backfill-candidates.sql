-- One-shot populate (run in the Supabase SQL editor — not the app).
-- The app API times out on a full catalog scan; this editor job can run longer.
-- Wait until the final count returns (~2000 names). Then refresh Admin → Players
-- and click Load catalog names (that button only reads this table).

set statement_timeout = '10min';

truncate public.dm2_player_backfill_candidates;

insert into public.dm2_player_backfill_candidates (
  sport_id,
  sport_label,
  name,
  name_key,
  card_count
)
select
  cs.sport_id,
  sport.label as sport_label,
  (array_agg(trim(part) order by length(trim(part)) desc, trim(part)))[1] as name,
  lower(trim(part)) as name_key,
  count(distinct c.id)::bigint as card_count
from public.dm2_cards c
inner join public.dm2_card_sets cs on cs.id = c.card_set_id
inner join public.pick_list_options sport
  on sport.id = cs.sport_id
  and sport.category = 'sport'
cross join lateral unnest(string_to_array(c.player, '/')) as part
where c.player is not null
  and length(trim(part)) > 0
group by cs.sport_id, sport.label, lower(trim(part));

notify pgrst, 'reload schema';

select count(*) as catalog_names from public.dm2_player_backfill_candidates;
