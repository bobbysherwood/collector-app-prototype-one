-- Preview the 61 groups that share card set + number + parallel.
-- Run in the SQL editor if you want to inspect before merging.

set statement_timeout = '5min';

select
  sport.label as sport,
  cs.year,
  b.name as brand,
  csn.name as card_set,
  c.card_number,
  coalesce(p.name, '(base)') as parallel,
  count(*) as card_rows,
  string_agg(distinct public.dm2_format_card_players(c.id), ' | ' order by public.dm2_format_card_players(c.id)) as players
from public.dm2_cards c
inner join public.dm2_card_sets cs on cs.id = c.card_set_id
inner join public.pick_list_options sport on sport.id = cs.sport_id
inner join public.dm2_brands b on b.id = cs.brand_id
inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
left join public.dm2_parallels p on p.id = c.parallel_id
group by
  sport.label,
  cs.year,
  b.name,
  csn.name,
  c.card_number,
  p.name,
  c.card_set_id,
  lower(trim(c.card_number)),
  coalesce(c.parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
having count(*) > 1
order by count(*) desc, sport.label, cs.year, csn.name, c.card_number;
