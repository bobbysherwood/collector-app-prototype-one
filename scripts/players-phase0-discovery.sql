-- Phase 0: dm2_players migration discovery (read-only)
-- Run: npx supabase db query -f scripts/players-phase0-discovery.sql --db-url "$DATABASE_URL"
-- Or: psql "$DATABASE_URL" -f scripts/players-phase0-discovery.sql

\set ON_ERROR_STOP on

\echo '=== 1. Volume ==='
SELECT 'dm2_cards_all' AS metric, count(*)::bigint AS value FROM public.dm2_cards
UNION ALL SELECT 'dm2_cards_active', count(*) FROM public.dm2_cards WHERE active
UNION ALL SELECT 'card_repository', count(*) FROM public.card_repository
UNION ALL SELECT 'assets', count(*) FROM public.assets
UNION ALL SELECT 'dm2_card_sets_all', count(*) FROM public.dm2_card_sets
UNION ALL SELECT 'dm2_card_sets_active', count(*) FROM public.dm2_card_sets WHERE active;

\echo '=== 2. Multi-player prevalence (dm2_cards) ==='
WITH base AS (
  SELECT player,
         cardinality(string_to_array(player, '/')) AS seg_count
  FROM public.dm2_cards
  WHERE active
),
tot AS (SELECT count(*)::numeric AS n FROM base)
SELECT
  (SELECT n FROM tot)::bigint AS active_cards,
  count(*) FILTER (WHERE player LIKE '%/%') AS multi_player_cards,
  round(100.0 * count(*) FILTER (WHERE player LIKE '%/%') / nullif((SELECT n FROM tot), 0), 2) AS pct_with_slash,
  max(seg_count) AS max_segments,
  max(length(player)) AS max_player_len
FROM base;

SELECT seg_count, count(*) AS cards
FROM (
  SELECT cardinality(string_to_array(player, '/')) AS seg_count
  FROM public.dm2_cards WHERE active
) s
GROUP BY seg_count
ORDER BY seg_count;

\echo '=== 2b. Multi-player (card_repository) ==='
WITH base AS (
  SELECT player, cardinality(string_to_array(player, '/')) AS seg_count
  FROM public.card_repository
),
tot AS (SELECT count(*)::numeric AS n FROM base)
SELECT
  (SELECT n FROM tot)::bigint AS rows,
  count(*) FILTER (WHERE player LIKE '%/%') AS multi_player_rows,
  round(100.0 * count(*) FILTER (WHERE player LIKE '%/%') / nullif((SELECT n FROM tot), 0), 2) AS pct_with_slash,
  max(seg_count) AS max_segments,
  max(length(player)) AS max_player_len
FROM base;

SELECT seg_count, count(*) AS rows
FROM (
  SELECT cardinality(string_to_array(player, '/')) AS seg_count FROM public.card_repository
) s
GROUP BY seg_count
ORDER BY seg_count;

\echo '=== 3. Distinct players sport-scoped (dm2) ==='
WITH segments AS (
  SELECT cs.sport_id, sport.label AS sport, lower(trim(part)) AS norm_seg, trim(part) AS display_seg
  FROM public.dm2_cards c
  JOIN public.dm2_card_sets cs ON cs.id = c.card_set_id
  JOIN public.pick_list_options sport ON sport.id = cs.sport_id
  CROSS JOIN LATERAL unnest(string_to_array(c.player, '/')) AS part
  WHERE c.active AND cs.active AND length(trim(part)) > 0
)
SELECT
  (SELECT count(DISTINCT (sport, norm_seg)) FROM segments) AS distinct_sport_norm_segment,
  (SELECT count(DISTINCT player) FROM public.dm2_cards WHERE active) AS distinct_raw_player_strings;

\echo '=== 3b. Top 20 duplicate clusters (normalized segment, multiple display variants) ==='
WITH segments AS (
  SELECT sport.label AS sport, lower(trim(part)) AS norm_seg, trim(part) AS display_seg
  FROM public.dm2_cards c
  JOIN public.dm2_card_sets cs ON cs.id = c.card_set_id
  JOIN public.pick_list_options sport ON sport.id = cs.sport_id
  CROSS JOIN LATERAL unnest(string_to_array(c.player, '/')) AS part
  WHERE c.active AND cs.active AND length(trim(part)) > 0
),
variants AS (
  SELECT sport, norm_seg, count(DISTINCT display_seg) AS display_variants,
         array_agg(DISTINCT display_seg ORDER BY display_seg) AS displays
  FROM segments
  GROUP BY sport, norm_seg
  HAVING count(DISTINCT display_seg) > 1
)
SELECT sport, norm_seg, display_variants, displays
FROM variants
ORDER BY display_variants DESC, sport, norm_seg
LIMIT 20;

\echo '=== 4. Case/spacing duplicates (single-player active dm2_cards) ==='
SELECT count(*) AS duplicate_groups
FROM (
  SELECT lower(trim(player)) AS k
  FROM public.dm2_cards
  WHERE active AND player NOT LIKE '%/%'
  GROUP BY lower(trim(player))
  HAVING count(DISTINCT player) > 1
) g;

SELECT lower(trim(player)) AS norm, array_agg(DISTINCT player ORDER BY player) AS raw_variants, count(*) AS card_rows
FROM public.dm2_cards
WHERE active AND player NOT LIKE '%/%'
GROUP BY lower(trim(player))
HAVING count(DISTINCT player) > 1
ORDER BY count(*) DESC
LIMIT 20;

\echo '=== 5. Blocklist / invalid candidates (dm2_cards active) ==='
SELECT count(*) AS blocklist_hits
FROM public.dm2_cards c
WHERE c.active AND (
  lower(c.player) ~ '(checklist|header|logo|\mteam\M)'
);

SELECT player, count(*) AS cards
FROM public.dm2_cards c
WHERE c.active AND (
  lower(c.player) ~ '(checklist|header|logo|\mteam\M)'
)
GROUP BY player
ORDER BY cards DESC, player
LIMIT 20;

\echo '=== 6. card_repository vs dm2 overlap (sport-agnostic normalized segments) ==='
WITH cr AS (
  SELECT DISTINCT lower(trim(part)) AS norm
  FROM public.card_repository
  CROSS JOIN LATERAL unnest(string_to_array(player, '/')) AS part
  WHERE length(trim(part)) > 0
),
dm2 AS (
  SELECT DISTINCT lower(trim(part)) AS norm
  FROM public.dm2_cards c
  CROSS JOIN LATERAL unnest(string_to_array(c.player, '/')) AS part
  WHERE c.active AND length(trim(part)) > 0
)
SELECT
  (SELECT count(*) FROM cr) AS distinct_cr_segments,
  (SELECT count(*) FROM dm2) AS distinct_dm2_segments,
  (SELECT count(*) FROM cr WHERE norm IN (SELECT norm FROM dm2)) AS cr_segments_in_dm2,
  (SELECT count(*) FROM cr WHERE norm NOT IN (SELECT norm FROM dm2)) AS cr_segments_not_in_dm2;

\echo '=== 7. Assets coverage ==='
SELECT count(DISTINCT (lower(trim(player_name)), lower(trim(sport)))) AS distinct_asset_player_sport
FROM public.assets;

WITH asset_keys AS (
  SELECT a.id, lower(trim(a.player_name)) AS asset_player, lower(trim(a.sport)) AS asset_sport
  FROM public.assets a
),
catalog AS (
  SELECT DISTINCT lower(trim(sport.label)) AS sport, lower(trim(part)) AS norm_seg
  FROM public.dm2_cards c
  JOIN public.dm2_card_sets cs ON cs.id = c.card_set_id
  JOIN public.pick_list_options sport ON sport.id = cs.sport_id
  CROSS JOIN LATERAL unnest(string_to_array(c.player, '/')) AS part
  WHERE c.active AND cs.active AND length(trim(part)) > 0
),
matched AS (
  SELECT ak.id
  FROM asset_keys ak
  WHERE EXISTS (
    SELECT 1 FROM catalog cat
    WHERE cat.sport = ak.asset_sport AND cat.norm_seg = ak.asset_player
  )
)
SELECT
  (SELECT count(*) FROM asset_keys) AS asset_rows,
  (SELECT count(*) FROM matched) AS assets_exact_match,
  round(100.0 * (SELECT count(*) FROM matched) / nullif((SELECT count(*) FROM asset_keys), 0), 2) AS pct_assets_matched;

SELECT DISTINCT a.player_name, a.sport
FROM public.assets a
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dm2_cards c
  JOIN public.dm2_card_sets cs ON cs.id = c.card_set_id
  JOIN public.pick_list_options sport ON sport.id = cs.sport_id
  CROSS JOIN LATERAL unnest(string_to_array(c.player, '/')) AS part
  WHERE c.active AND cs.active
    AND lower(trim(sport.label)) = lower(trim(a.sport))
    AND lower(trim(part)) = lower(trim(a.player_name))
)
ORDER BY a.sport, a.player_name
LIMIT 20;

\echo '=== 8. Uniqueness impact preview (normalized segment sets) ==='
WITH card_seg AS (
  SELECT
    c.id,
    c.card_set_id,
    c.card_number,
    c.parallel_id,
    array_agg(lower(trim(part)) ORDER BY lower(trim(part))) AS seg_set
  FROM public.dm2_cards c
  CROSS JOIN LATERAL unnest(string_to_array(c.player, '/')) AS part
  WHERE c.active AND length(trim(part)) > 0
  GROUP BY c.id, c.card_set_id, c.card_number, c.parallel_id
),
keyed AS (
  SELECT card_set_id, lower(trim(card_number)) AS cn, coalesce(parallel_id, '00000000-0000-0000-0000-000000000000'::uuid) AS pid,
         seg_set, count(*) AS cards_in_bucket
  FROM card_seg
  GROUP BY card_set_id, lower(trim(card_number)), coalesce(parallel_id, '00000000-0000-0000-0000-000000000000'::uuid), seg_set
)
SELECT
  count(*) AS unique_buckets,
  count(*) FILTER (WHERE cards_in_bucket > 1) AS buckets_with_collisions,
  coalesce(sum(cards_in_bucket) FILTER (WHERE cards_in_bucket > 1), 0) AS cards_in_collision_buckets
FROM keyed;

SELECT card_set_id, cn, pid, seg_set, cards_in_bucket
FROM keyed
WHERE cards_in_bucket > 1
ORDER BY cards_in_bucket DESC
LIMIT 20;
