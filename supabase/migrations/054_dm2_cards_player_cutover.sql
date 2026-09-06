-- Catalog cutover: cards store player UUIDs only (dm2_card_players).
-- Run in the Supabase SQL editor after the backfill (0 unlinked cards).

set statement_timeout = '10min';

-- Same set + number + parallel used to be unique only because player text differed.
-- Merge extras onto one keeper card (prefer a row with an image), then drop player.

do $$
declare
  missing_links int;
  collisions int;
begin
  with ranked as (
    select
      c.id,
      row_number() over (
        partition by
          c.card_set_id,
          lower(trim(c.card_number)),
          coalesce(c.parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
        order by
          (c.image_path is not null) desc,
          c.created_at asc,
          c.id
      ) as rn,
      first_value(c.id) over (
        partition by
          c.card_set_id,
          lower(trim(c.card_number)),
          coalesce(c.parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
        order by
          (c.image_path is not null) desc,
          c.created_at asc,
          c.id
      ) as keeper_id
    from public.dm2_cards c
  ),
  extras as (
    select id as loser_id, keeper_id
    from ranked
    where rn > 1
  )
  insert into public.dm2_card_players (card_id, player_id, sort_order)
  select
    e.keeper_id,
    cp.player_id,
    coalesce(
      (select max(existing.sort_order) from public.dm2_card_players existing where existing.card_id = e.keeper_id),
      -1
    ) + row_number() over (partition by e.keeper_id order by cp.sort_order, cp.player_id)
  from extras e
  inner join public.dm2_card_players cp on cp.card_id = e.loser_id
  on conflict (card_id, player_id) do nothing;

  with ranked as (
    select
      c.id,
      row_number() over (
        partition by
          c.card_set_id,
          lower(trim(c.card_number)),
          coalesce(c.parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
        order by
          (c.image_path is not null) desc,
          c.created_at asc,
          c.id
      ) as rn,
      first_value(c.id) over (
        partition by
          c.card_set_id,
          lower(trim(c.card_number)),
          coalesce(c.parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
        order by
          (c.image_path is not null) desc,
          c.created_at asc,
          c.id
      ) as keeper_id
    from public.dm2_cards c
  ),
  extras as (
    select id as loser_id, keeper_id
    from ranked
    where rn > 1
  )
  insert into public.dm2_card_attributes (card_id, attribute_id)
  select e.keeper_id, ca.attribute_id
  from extras e
  inner join public.dm2_card_attributes ca on ca.card_id = e.loser_id
  on conflict (card_id, attribute_id) do nothing;

  with ranked as (
    select
      c.id,
      c.image_path,
      row_number() over (
        partition by
          c.card_set_id,
          lower(trim(c.card_number)),
          coalesce(c.parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
        order by
          (c.image_path is not null) desc,
          c.created_at asc,
          c.id
      ) as rn,
      first_value(c.id) over (
        partition by
          c.card_set_id,
          lower(trim(c.card_number)),
          coalesce(c.parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
        order by
          (c.image_path is not null) desc,
          c.created_at asc,
          c.id
      ) as keeper_id
    from public.dm2_cards c
  )
  update public.dm2_cards keeper
  set
    image_path = coalesce(keeper.image_path, extra.image_path),
    updated_at = now()
  from ranked extra
  where extra.rn > 1
    and extra.keeper_id = keeper.id
    and keeper.image_path is null
    and extra.image_path is not null;

  delete from public.dm2_cards c
  using (
    select
      c.id,
      row_number() over (
        partition by
          c.card_set_id,
          lower(trim(c.card_number)),
          coalesce(c.parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
        order by
          (c.image_path is not null) desc,
          c.created_at asc,
          c.id
      ) as rn
    from public.dm2_cards c
  ) extra
  where extra.id = c.id
    and extra.rn > 1;

  select count(*) into missing_links
  from public.dm2_cards c
  where not exists (
    select 1 from public.dm2_card_players cp where cp.card_id = c.id
  );
  if missing_links > 0 then
    raise exception
      'Cannot drop dm2_cards.player: % cards have no player link. Relink first.',
      missing_links;
  end if;

  select count(*) into collisions
  from (
    select 1
    from public.dm2_cards
    group by
      card_set_id,
      lower(trim(card_number)),
      coalesce(parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
    having count(*) > 1
  ) x;
  if collisions > 0 then
    raise exception
      'Cannot change uniqueness: % groups still share card set + number + parallel.',
      collisions;
  end if;
end;
$$;

create or replace function public.dm2_format_card_players(p_card_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select string_agg(pl.name, '/' order by cp.sort_order, pl.name)
      from public.dm2_card_players cp
      inner join public.dm2_players pl on pl.id = cp.player_id
      where cp.card_id = p_card_id
        and pl.active = true
    ),
    ''
  );
$$;

create or replace function public.list_dm2_player_backfill_candidates()
returns table (
  sport_id uuid,
  sport_label text,
  name text,
  name_key text,
  card_count bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    c.sport_id,
    c.sport_label,
    c.name,
    c.name_key,
    c.card_count
  from public.dm2_player_backfill_candidates c
  where public.is_admin()
    and not exists (
      select 1
      from public.dm2_players pl
      where pl.sport_id = c.sport_id
        and pl.name_key = c.name_key
    )
    and not exists (
      select 1
      from public.dm2_player_aliases a
      where a.sport_id = c.sport_id
        and a.name_key = c.name_key
    )
  order by c.sport_label, c.name;
$$;

create or replace function public.refresh_dm2_player_backfill_batch(
  p_after_card_id uuid default null,
  p_limit int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;
  return jsonb_build_object(
    'processed', 0,
    'done', true,
    'nextAfterCardId', null
  );
end;
$$;

create or replace function public.approve_dm2_player_backfill(
  p_sport_id uuid,
  p_names text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_players int := 0;
  raw_name text;
  player_name text;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  foreach raw_name in array coalesce(p_names, '{}'::text[])
  loop
    player_name := trim(raw_name);
    if length(player_name) = 0 then
      continue;
    end if;
    insert into public.dm2_players (sport_id, name, active)
    values (p_sport_id, player_name, true)
    on conflict (sport_id, name_key) do nothing;
    created_players := created_players + 1;
  end loop;

  return jsonb_build_object(
    'playersCreated', created_players,
    'linksCreated', 0
  );
end;
$$;

create or replace function public.link_dm2_card_players_batch(
  p_after_card_id uuid default null,
  p_limit int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;
  return jsonb_build_object(
    'processed', 0,
    'linksCreated', 0,
    'done', true,
    'nextAfterCardId', null
  );
end;
$$;

drop function if exists public.get_dm2_card_by_id(uuid);

create or replace function public.get_dm2_card_by_id(card_id uuid)
returns table (
  id uuid,
  card_set_id uuid,
  sport text,
  year smallint,
  manufacturer text,
  brand text,
  card_set_category text,
  card_set_name text,
  card_number text,
  player text,
  parallel text,
  image_path text
)
language sql
security definer
set search_path = ''
as $$
  select
    c.id,
    c.card_set_id,
    sport.label as sport,
    cs.year,
    m.name as manufacturer,
    b.name as brand,
    csc.name as card_set_category,
    csn.name as card_set_name,
    c.card_number,
    public.dm2_format_card_players(c.id) as player,
    p.name as parallel,
    c.image_path
  from public.dm2_cards c
  inner join public.dm2_card_sets cs on cs.id = c.card_set_id
  inner join public.pick_list_options sport on sport.id = cs.sport_id
  inner join public.dm2_brands b on b.id = cs.brand_id
  inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
  inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
  inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
  left join public.dm2_parallels p on p.id = c.parallel_id
  where auth.uid() is not null
    and c.id = card_id
    and c.active = true
    and cs.active = true
  limit 1;
$$;

revoke all on function public.get_dm2_card_by_id(uuid) from public;
grant execute on function public.get_dm2_card_by_id(uuid) to authenticated;

create or replace function public.lookup_dm2_card_attributes_batch(requests jsonb)
returns table (
  asset_id uuid,
  attribute_names text[]
)
language sql
security definer
set search_path = ''
as $$
  with input_rows as (
    select
      nullif(trim(entry ->> 'asset_id'), '')::uuid as asset_id,
      trim(entry ->> 'player') as player,
      trim(entry ->> 'card_number') as card_number,
      trim(entry ->> 'sport') as sport,
      nullif(entry ->> 'year', '')::smallint as year,
      trim(entry ->> 'brand') as brand,
      trim(entry ->> 'manufacturer') as manufacturer,
      trim(entry ->> 'card_set_category') as card_set_category,
      trim(entry ->> 'card_set_name') as card_set_name,
      trim(coalesce(entry ->> 'parallel', '')) as parallel
    from jsonb_array_elements(coalesce(requests, '[]'::jsonb)) as entry
  )
  select
    input_rows.asset_id,
    coalesce(
      (
        select array_agg(a.name order by a.name)
        from public.dm2_cards c
        inner join public.dm2_card_sets cs on cs.id = c.card_set_id
        inner join public.pick_list_options sport on sport.id = cs.sport_id
        inner join public.dm2_brands b on b.id = cs.brand_id
        inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
        inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
        inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
        left join public.dm2_parallels p on p.id = c.parallel_id
        inner join public.dm2_card_attributes ca on ca.card_id = c.id
        inner join public.dm2_attributes a on a.id = ca.attribute_id
        where c.active = true
          and cs.active = true
          and a.active = true
          and input_rows.asset_id is not null
          and lower(trim(c.card_number)) = lower(input_rows.card_number)
          and lower(trim(sport.label)) = lower(input_rows.sport)
          and cs.year = input_rows.year
          and lower(trim(b.name)) = lower(input_rows.brand)
          and lower(trim(m.name)) = lower(input_rows.manufacturer)
          and lower(trim(csc.name)) = lower(input_rows.card_set_category)
          and lower(trim(csn.name)) = lower(input_rows.card_set_name)
          and coalesce(lower(trim(p.name)), '') = lower(input_rows.parallel)
          and (
            lower(public.dm2_format_card_players(c.id)) = lower(input_rows.player)
            or exists (
              select 1
              from public.dm2_card_players cp
              inner join public.dm2_players pl on pl.id = cp.player_id
              where cp.card_id = c.id
                and lower(trim(pl.name)) = lower(input_rows.player)
            )
          )
      ),
      '{}'::text[]
    ) as attribute_names
  from input_rows
  where auth.uid() is not null
    and input_rows.asset_id is not null;
$$;

drop index if exists public.dm2_cards_unique_entry_idx;

create unique index dm2_cards_unique_entry_idx
  on public.dm2_cards (
    card_set_id,
    lower(trim(card_number)),
    coalesce(parallel_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

alter table public.dm2_cards drop column if exists player;

create or replace function public.upsert_dm2_card(
  p_id uuid,
  p_card_set_id uuid,
  p_card_number text,
  p_parallel_id uuid,
  p_player_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  card_id uuid;
  sport uuid;
  player_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  if p_card_set_id is null or length(trim(coalesce(p_card_number, ''))) = 0 then
    raise exception 'Card set and card number are required';
  end if;

  select array_agg(distinct id order by id)
  into player_ids
  from unnest(coalesce(p_player_ids, '{}'::uuid[])) as id
  where id is not null;

  if coalesce(array_length(player_ids, 1), 0) = 0 then
    raise exception 'Each card must have at least one player';
  end if;

  select cs.sport_id into sport
  from public.dm2_card_sets cs
  where cs.id = p_card_set_id;
  if sport is null then
    raise exception 'Card set not found';
  end if;

  if exists (
    select 1
    from unnest(player_ids) as pid
    where not exists (
      select 1
      from public.dm2_players pl
      where pl.id = pid
        and pl.sport_id = sport
    )
  ) then
    raise exception 'Every player must belong to the card set sport';
  end if;

  if p_id is null then
    insert into public.dm2_cards (card_set_id, card_number, parallel_id, active)
    values (p_card_set_id, trim(p_card_number), p_parallel_id, true)
    returning id into card_id;
  else
    update public.dm2_cards
    set
      card_set_id = p_card_set_id,
      card_number = trim(p_card_number),
      parallel_id = p_parallel_id,
      updated_at = now()
    where id = p_id
    returning id into card_id;
    if card_id is null then
      raise exception 'Card not found';
    end if;
    delete from public.dm2_card_players cp where cp.card_id = card_id;
  end if;

  insert into public.dm2_card_players (card_id, player_id, sort_order)
  select card_id, player_ids[i], i - 1
  from generate_subscripts(player_ids, 1) as i;

  return card_id;
end;
$$;

revoke all on function public.upsert_dm2_card(uuid, uuid, text, uuid, uuid[]) from public;
grant execute on function public.upsert_dm2_card(uuid, uuid, text, uuid, uuid[]) to authenticated;

create or replace function public.create_dm2_cards_with_players(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created int := 0;
  skipped int := 0;
  rec jsonb;
  new_id uuid;
  player_ids uuid[];
  sport uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  for rec in
    select value
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    select array_agg(distinct id)
    into player_ids
    from (
      select (jsonb_array_elements_text(coalesce(rec->'player_ids', '[]'::jsonb)))::uuid as id
    ) ids
    where id is not null;

    if coalesce(array_length(player_ids, 1), 0) = 0 then
      continue;
    end if;

    select cs.sport_id into sport
    from public.dm2_card_sets cs
    where cs.id = (rec->>'card_set_id')::uuid;
    if sport is null then
      continue;
    end if;

    if exists (
      select 1
      from unnest(player_ids) as pid
      where not exists (
        select 1
        from public.dm2_players pl
        where pl.id = pid
          and pl.sport_id = sport
      )
    ) then
      continue;
    end if;

    begin
      insert into public.dm2_cards (card_set_id, card_number, parallel_id, active)
      values (
        (rec->>'card_set_id')::uuid,
        trim(rec->>'card_number'),
        nullif(nullif(rec->>'parallel_id', ''), 'null')::uuid,
        true
      )
      returning id into new_id;

      insert into public.dm2_card_players (card_id, player_id, sort_order)
      select new_id, player_ids[i], i - 1
      from generate_subscripts(player_ids, 1) as i;

      created := created + 1;
    exception
      when unique_violation then
        skipped := skipped + 1;
    end;
  end loop;

  return jsonb_build_object('created', created, 'skipped', skipped);
end;
$$;

revoke all on function public.create_dm2_cards_with_players(jsonb) from public;
grant execute on function public.create_dm2_cards_with_players(jsonb) to authenticated;

notify pgrst, 'reload schema';
