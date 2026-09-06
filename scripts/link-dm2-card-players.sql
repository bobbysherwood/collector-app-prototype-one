-- One-shot card → player links (run in the Supabase SQL editor — not the app).
-- Matches catalog player text (split on '/') to dm2_players and merge aliases.
-- Safe to re-run: existing (card_id, player_id) rows are left alone.

set statement_timeout = '10min';

insert into public.dm2_card_players (card_id, player_id, sort_order)
select
  linked.card_id,
  linked.player_id,
  (row_number() over (partition by linked.card_id order by linked.player_id) - 1)::int
from (
  select distinct
    c.id as card_id,
    n.player_id
  from public.dm2_cards c
  inner join public.dm2_card_sets cs on cs.id = c.card_set_id
  cross join lateral unnest(string_to_array(c.player, '/')) as part
  inner join (
    select pl.id as player_id, pl.sport_id, pl.name_key
    from public.dm2_players pl
    union
    select a.player_id, a.sport_id, a.name_key
    from public.dm2_player_aliases a
  ) n
    on n.sport_id = cs.sport_id
   and n.name_key = lower(trim(part))
  where c.player is not null
    and length(trim(part)) > 0
) linked
on conflict (card_id, player_id) do nothing;

notify pgrst, 'reload schema';

select
  (select count(*) from public.dm2_card_players) as card_player_links,
  (select count(*) from public.dm2_cards c
    where not exists (
      select 1 from public.dm2_card_players cp where cp.card_id = c.id
    )) as cards_still_unlinked;
