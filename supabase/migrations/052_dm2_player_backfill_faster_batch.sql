-- Cheaper in-app batches: walk cards by primary key, smaller page size.

create or replace function public.refresh_dm2_player_backfill_batch(
  p_after_card_id uuid default null,
  p_limit int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_limit int := least(greatest(coalesce(p_limit, 500), 1), 1000);
  processed int := 0;
  last_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  select max(s.id), count(*)::int
  into last_id, processed
  from (
    select c.id
    from public.dm2_cards c
    where p_after_card_id is null or c.id > p_after_card_id
    order by c.id
    limit batch_limit
  ) s;

  if last_id is null then
    return jsonb_build_object(
      'processed', 0,
      'done', true,
      'nextAfterCardId', null
    );
  end if;

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
  where (p_after_card_id is null or c.id > p_after_card_id)
    and c.id <= last_id
    and c.player is not null
    and length(trim(part)) > 0
  group by cs.sport_id, sport.label, lower(trim(part))
  on conflict (sport_id, name_key) do update
    set
      card_count = public.dm2_player_backfill_candidates.card_count + excluded.card_count,
      name = case
        when length(excluded.name) > length(public.dm2_player_backfill_candidates.name)
        then excluded.name
        else public.dm2_player_backfill_candidates.name
      end;

  return jsonb_build_object(
    'processed', processed,
    'done', processed < batch_limit,
    'nextAfterCardId', last_id
  );
end;
$$;

notify pgrst, 'reload schema';
