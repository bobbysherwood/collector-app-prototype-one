-- Create the ~1,064 catalog names missed by the 1000-row API cap.
-- Skips 90–99% pairs so those still go through the admin review UI.
-- Then relinks cards. Run in the Supabase SQL editor.

set statement_timeout = '10min';
create extension if not exists fuzzystrmatch;

with missing as (
  select c.sport_id, c.sport_label, c.name, c.name_key
  from public.dm2_player_backfill_candidates c
  where length(c.name) <= 200
    and not exists (
      select 1 from public.dm2_players p
      where p.sport_id = c.sport_id and p.name_key = c.name_key
    )
    and not exists (
      select 1 from public.dm2_player_aliases a
      where a.sport_id = c.sport_id and a.name_key = c.name_key
    )
),
known as (
  select sport_id, name_key from public.dm2_players
  union
  select sport_id, name_key from public.dm2_player_aliases
  union
  select sport_id, name_key from missing
),
review_keys as (
  select distinct a.sport_id, a.name_key
  from missing a
  inner join known b
    on a.sport_id = b.sport_id
   and a.name_key <> b.name_key
   and greatest(length(a.name_key), length(b.name_key)) > 0
   and abs(length(a.name_key) - length(b.name_key))::double precision
        / greatest(length(a.name_key), length(b.name_key)) <= 0.10
   and 1.0 - levenshtein(a.name_key, b.name_key)::double precision
        / greatest(length(a.name_key), length(b.name_key)) >= 0.90
   and 1.0 - levenshtein(a.name_key, b.name_key)::double precision
        / greatest(length(a.name_key), length(b.name_key)) < 1.0
)
insert into public.dm2_players (sport_id, name, active)
select m.sport_id, m.name, true
from missing m
where not exists (
  select 1 from review_keys r
  where r.sport_id = m.sport_id and r.name_key = m.name_key
)
on conflict (sport_id, name_key) do nothing;

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

select
  (select count(*) from public.dm2_players) as players,
  (select count(*) from public.dm2_player_aliases) as aliases,
  (select count(*) from public.dm2_card_players) as card_player_links,
  (select count(*) from public.dm2_cards c
    where not exists (
      select 1 from public.dm2_card_players cp where cp.card_id = c.id
    )) as cards_still_unlinked;
