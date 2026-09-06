-- Cheaper in-app card-link batches: walk cards by primary key, smaller page size.

create or replace function public.link_dm2_card_players_batch(
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
  links_created int := 0;
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
      'linksCreated', 0,
      'done', true,
      'nextAfterCardId', null
    );
  end if;

  with named as (
    select pl.id as player_id, pl.sport_id, pl.name_key
    from public.dm2_players pl
    union
    select a.player_id, a.sport_id, a.name_key
    from public.dm2_player_aliases a
  ),
  inserted as (
    insert into public.dm2_card_players (card_id, player_id, sort_order)
    select
      c.id,
      n.player_id,
      coalesce(
        (
          select max(existing.sort_order) + 1
          from public.dm2_card_players existing
          where existing.card_id = c.id
        ),
        0
      )
    from public.dm2_cards c
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    cross join lateral unnest(string_to_array(c.player, '/')) as part
    inner join named n
      on n.sport_id = cs.sport_id
     and n.name_key = lower(trim(part))
    where (p_after_card_id is null or c.id > p_after_card_id)
      and c.id <= last_id
      and c.player is not null
      and length(trim(part)) > 0
    on conflict (card_id, player_id) do nothing
    returning 1
  )
  select count(*)::int into links_created from inserted;

  return jsonb_build_object(
    'processed', processed,
    'linksCreated', links_created,
    'done', processed < batch_limit,
    'nextAfterCardId', last_id
  );
end;
$$;

notify pgrst, 'reload schema';
