-- Distinct catalog player names (split on '/', unique per sport)
-- then classify with normalized Levenshtein similarity:
--   100% same name_key → already one UUID (collapsed here)
--   similarity < 0.90  → auto-create (own UUID)
--   0.90 <= similarity < 1.0 → manual review
--
-- Run in the Supabase SQL editor.

create extension if not exists fuzzystrmatch;

with parts as (
  select distinct
    cs.sport_id,
    sport.label as sport_label,
    trim(part) as name,
    lower(trim(regexp_replace(part, '\s+', ' ', 'g'))) as name_key
  from public.dm2_cards c
  inner join public.dm2_card_sets cs on cs.id = c.card_set_id
  inner join public.pick_list_options sport
    on sport.id = cs.sport_id
    and sport.category = 'sport'
  cross join lateral unnest(string_to_array(c.player, '/')) as part
  where c.player is not null
    and length(trim(part)) > 0
),
pairs as (
  select
    a.sport_id,
    a.sport_label,
    a.name as left_name,
    b.name as right_name,
    a.name_key as left_key,
    b.name_key as right_key,
    1.0 - levenshtein(a.name_key, b.name_key)::double precision
      / greatest(length(a.name_key), length(b.name_key)) as similarity
  from parts a
  inner join parts b
    on a.sport_id = b.sport_id
   and a.name_key < b.name_key
   and greatest(length(a.name_key), length(b.name_key)) > 0
   and abs(length(a.name_key) - length(b.name_key))::double precision
        / greatest(length(a.name_key), length(b.name_key)) <= 0.10
),
review_pairs as (
  select *
  from pairs
  where similarity >= 0.90
    and similarity < 1
),
review_names as (
  select sport_id, left_key as name_key from review_pairs
  union
  select sport_id, right_key as name_key from review_pairs
)
select
  (select count(*) from parts) as distinct_player_names,
  (select count(*) from parts) - (select count(*) from review_names) as auto_create_count,
  (select count(*) from review_names) as manual_review_name_count,
  (select count(*) from review_pairs) as manual_review_pair_count;

-- Optional: inspect the review pairs (run separately if you want the list)
-- select sport_label, left_name, right_name, round(similarity::numeric, 3) as similarity
-- from review_pairs
-- order by similarity desc, left_name;
