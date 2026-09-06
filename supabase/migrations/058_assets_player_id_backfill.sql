-- Link existing holdings assets to catalog players when sport + name match.
-- assets.player_id was added in 049_dm2_players.sql.

update public.assets a
set player_id = p.id
from public.dm2_players p
inner join public.pick_list_options sport
  on sport.id = p.sport_id
  and sport.category = 'sport'
where a.player_id is null
  and p.active = true
  and lower(trim(a.player_name)) = p.name_key
  and lower(trim(a.sport)) = lower(trim(sport.label));
