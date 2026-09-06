-- Player source of truth: UUID + name unique per sport, linked to cards via junction.
-- Existing dm2_cards.player text remains until the one-time admin backfill is approved.

create table if not exists public.dm2_players (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.pick_list_options (id) on delete restrict,
  name varchar(200) not null,
  name_key text generated always as (lower(trim(name))) stored,
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_players_name_not_blank check (length(trim(name)) > 0),
  constraint dm2_players_sport_name_unique unique (sport_id, name_key)
);

create index if not exists dm2_players_sport_id_idx
  on public.dm2_players (sport_id);

create index if not exists dm2_players_name_key_idx
  on public.dm2_players (name_key);

create table if not exists public.dm2_card_players (
  card_id uuid not null references public.dm2_cards (id) on delete cascade,
  player_id uuid not null references public.dm2_players (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (card_id, player_id)
);

create index if not exists dm2_card_players_player_id_idx
  on public.dm2_card_players (player_id);

alter table public.dm2_players enable row level security;
alter table public.dm2_card_players enable row level security;

drop policy if exists "Users can read active players" on public.dm2_players;
drop policy if exists "Admins can insert players" on public.dm2_players;
drop policy if exists "Admins can update players" on public.dm2_players;
drop policy if exists "Admins can delete players" on public.dm2_players;
drop policy if exists "Users can read card players" on public.dm2_card_players;
drop policy if exists "Admins can insert card players" on public.dm2_card_players;
drop policy if exists "Admins can update card players" on public.dm2_card_players;
drop policy if exists "Admins can delete card players" on public.dm2_card_players;

create policy "Users can read active players"
  on public.dm2_players
  for select
  to authenticated
  using (active = true or public.is_admin());

create policy "Admins can insert players"
  on public.dm2_players
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update players"
  on public.dm2_players
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete players"
  on public.dm2_players
  for delete
  to authenticated
  using (public.is_admin());

create policy "Users can read card players"
  on public.dm2_card_players
  for select
  to authenticated
  using (true);

create policy "Admins can insert card players"
  on public.dm2_card_players
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update card players"
  on public.dm2_card_players
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete card players"
  on public.dm2_card_players
  for delete
  to authenticated
  using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('dm2-player-images', 'dm2-player-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read dm2 player images" on storage.objects;
drop policy if exists "Admins insert dm2 player images" on storage.objects;
drop policy if exists "Admins update dm2 player images" on storage.objects;
drop policy if exists "Admins delete dm2 player images" on storage.objects;

create policy "Public read dm2 player images"
  on storage.objects
  for select
  using (bucket_id = 'dm2-player-images');

create policy "Admins insert dm2 player images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'dm2-player-images' and public.is_admin());

create policy "Admins update dm2 player images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'dm2-player-images' and public.is_admin())
  with check (bucket_id = 'dm2-player-images' and public.is_admin());

create policy "Admins delete dm2 player images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'dm2-player-images' and public.is_admin());

insert into public.dm2_entity_descriptions (entity_key, title, description, table_name, sort_order)
values (
  'player',
  'Player Table',
  'Stores the canonical athlete or subject linked to catalog cards. Names are unique per sport and use the exact checklist spelling. Cards associate through dm2_card_players; a card may link to more than one player. Do not store free-text player names on cards.',
  'dm2_players',
  65
)
on conflict (entity_key) do update
set
  title = excluded.title,
  description = excluded.description,
  table_name = excluded.table_name,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.dm2_format_card_players(p_card_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(
      (
        select string_agg(pl.name, '/' order by cp.sort_order, pl.name)
        from public.dm2_card_players cp
        inner join public.dm2_players pl on pl.id = cp.player_id
        where cp.card_id = p_card_id
          and pl.active = true
      ),
      ''
    ),
    (select c.player from public.dm2_cards c where c.id = p_card_id)
  );
$$;

revoke all on function public.dm2_format_card_players(uuid) from public;
grant execute on function public.dm2_format_card_players(uuid) to authenticated;

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
  with parts as (
    select
      cs.sport_id,
      sport.label as sport_label,
      trim(part) as name,
      lower(trim(part)) as name_key,
      c.id as card_id
    from public.dm2_cards c
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    inner join public.pick_list_options sport on sport.id = cs.sport_id
      and sport.category = 'sport'
    cross join lateral unnest(string_to_array(c.player, '/')) as part
    where public.is_admin()
      and c.player is not null
      and length(trim(part)) > 0
  )
  select
    p.sport_id,
    p.sport_label,
    (array_agg(p.name order by length(p.name) desc, p.name))[1] as name,
    p.name_key,
    count(distinct p.card_id)::bigint as card_count
  from parts p
  where not exists (
    select 1
    from public.dm2_players pl
    where pl.sport_id = p.sport_id
      and lower(trim(pl.name)) = p.name_key
  )
  group by p.sport_id, p.sport_label, p.name_key
  order by p.sport_label, (array_agg(p.name order by length(p.name) desc, p.name))[1];
$$;

revoke all on function public.list_dm2_player_backfill_candidates() from public;
grant execute on function public.list_dm2_player_backfill_candidates() to authenticated;

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
  created_links int := 0;
  raw_name text;
  player_name text;
  player_row public.dm2_players%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  if p_sport_id is null then
    raise exception 'Sport is required';
  end if;

  if not exists (
    select 1
    from public.pick_list_options sport
    where sport.id = p_sport_id
      and sport.category = 'sport'
  ) then
    raise exception 'Sport not found';
  end if;

  foreach raw_name in array coalesce(p_names, '{}'::text[])
  loop
    player_name := trim(raw_name);
    if length(player_name) = 0 then
      continue;
    end if;

    insert into public.dm2_players (sport_id, name, active)
    values (p_sport_id, player_name, true)
    on conflict (sport_id, name_key) do update
      set updated_at = now()
    returning * into player_row;

    if player_row.id is null then
      select * into player_row
      from public.dm2_players
      where sport_id = p_sport_id
        and lower(trim(name)) = lower(player_name)
      limit 1;
    else
      created_players := created_players + 1;
    end if;

    with matching_cards as (
      select c.id as card_id
      from public.dm2_cards c
      inner join public.dm2_card_sets cs on cs.id = c.card_set_id
      cross join lateral unnest(string_to_array(c.player, '/')) as part
      where cs.sport_id = p_sport_id
        and lower(trim(part)) = lower(player_name)
    ),
    inserted as (
      insert into public.dm2_card_players (card_id, player_id, sort_order)
      select
        mc.card_id,
        player_row.id,
        coalesce(
          (
            select max(existing.sort_order) + 1
            from public.dm2_card_players existing
            where existing.card_id = mc.card_id
          ),
          0
        )
      from matching_cards mc
      on conflict (card_id, player_id) do nothing
      returning 1
    )
    select created_links + coalesce((select count(*) from inserted), 0)
    into created_links;
  end loop;

  return jsonb_build_object(
    'playersCreated', created_players,
    'linksCreated', created_links
  );
end;
$$;

revoke all on function public.approve_dm2_player_backfill(uuid, text[]) from public;
grant execute on function public.approve_dm2_player_backfill(uuid, text[]) to authenticated;

drop function if exists public.search_dm2_players(text, int);

create or replace function public.search_dm2_players(
  query text,
  lim int default 50
)
returns table (
  id uuid,
  player text,
  sport text,
  sport_id uuid,
  image_path text,
  card_count bigint
)
language sql
security definer
set search_path = ''
as $$
  with tokens as (
    select token
    from unnest(string_to_array(lower(trim(query)), ' ')) as token
    where token <> ''
  )
  select
    pl.id,
    pl.name as player,
    sport.label as sport,
    pl.sport_id,
    pl.image_path,
    count(distinct cp.card_id)::bigint as card_count
  from public.dm2_players pl
  inner join public.pick_list_options sport
    on sport.id = pl.sport_id
    and sport.category = 'sport'
  left join public.dm2_card_players cp on cp.player_id = pl.id
  left join public.dm2_cards c on c.id = cp.card_id and c.active = true
  where auth.uid() is not null
    and pl.active = true
    and length(trim(query)) >= 2
    and (select count(*) from tokens) > 0
    and not exists (
      select 1
      from tokens t
      where strpos(lower(pl.name), t.token) = 0
    )
  group by pl.id, pl.name, sport.label, pl.sport_id, pl.image_path
  order by
    case when lower(trim(pl.name)) = lower(trim(query)) then 0 else 1 end,
    count(distinct cp.card_id) desc,
    pl.name asc
  limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

revoke all on function public.search_dm2_players(text, int) from public;
grant execute on function public.search_dm2_players(text, int) to authenticated;

drop function if exists public.search_dm2_cards(text, int);
drop function if exists public.search_dm2_cards(text, int, int);

create or replace function public.search_dm2_cards(
  query text,
  lim int default 24,
  row_offset int default 0
)
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
  image_path text,
  attribute_names text[],
  total_count bigint
)
language sql
security definer
set search_path = ''
as $$
  with tokens as (
    select token
    from unnest(string_to_array(lower(trim(query)), ' ')) as token
    where token <> ''
  ),
  haystack as (
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
      c.image_path,
      (
        select coalesce(array_agg(a.name order by a.name), '{}'::text[])
        from public.dm2_card_attributes ca
        inner join public.dm2_attributes a on a.id = ca.attribute_id
        where ca.card_id = c.id
          and a.active = true
      ) as attribute_names,
      lower(
        sport.label || ' ' || cs.year::text || ' ' || m.name || ' ' ||
        b.name || ' ' || csc.name || ' ' || csn.name || ' ' ||
        c.card_number || ' ' || public.dm2_format_card_players(c.id) || ' ' ||
        coalesce(p.name, '')
      ) as search_text,
      lower(public.dm2_format_card_players(c.id)) as player_key
    from public.dm2_cards c
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    inner join public.pick_list_options sport on sport.id = cs.sport_id
    inner join public.dm2_brands b on b.id = cs.brand_id
    inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
    inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
    inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
    left join public.dm2_parallels p on p.id = c.parallel_id
    where c.active = true
      and cs.active = true
  ),
  matched as (
    select h.*
    from haystack h
    where auth.uid() is not null
      and length(trim(query)) >= 2
      and (select count(*) from tokens) > 0
      and (
        not exists (
          select 1
          from tokens t
          where strpos(h.search_text, t.token) = 0
        )
        or not exists (
          select 1
          from tokens t
          where strpos(h.player_key, t.token) = 0
        )
      )
  )
  select
    m.id,
    m.card_set_id,
    m.sport,
    m.year,
    m.manufacturer,
    m.brand,
    m.card_set_category,
    m.card_set_name,
    m.card_number,
    m.player,
    m.parallel,
    m.image_path,
    m.attribute_names,
    count(*) over() as total_count
  from matched m
  order by
    case
      when not exists (
        select 1
        from tokens t
        where strpos(m.player_key, t.token) = 0
      ) then 0
      else 1
    end,
    m.year desc,
    m.player asc,
    m.card_set_name asc,
    m.card_number asc
  limit least(greatest(coalesce(lim, 24), 1), 100)
  offset greatest(coalesce(row_offset, 0), 0);
$$;

revoke all on function public.search_dm2_cards(text, int, int) from public;
grant execute on function public.search_dm2_cards(text, int, int) to authenticated;

create or replace function public.get_dm2_cards_for_player(
  p_player_id uuid,
  lim int default 24,
  row_offset int default 0
)
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
  image_path text,
  attribute_names text[],
  total_count bigint
)
language sql
security definer
set search_path = ''
as $$
  with matched as (
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
      c.image_path,
      (
        select coalesce(array_agg(a.name order by a.name), '{}'::text[])
        from public.dm2_card_attributes ca
        inner join public.dm2_attributes a on a.id = ca.attribute_id
        where ca.card_id = c.id
          and a.active = true
      ) as attribute_names
    from public.dm2_card_players cp
    inner join public.dm2_cards c on c.id = cp.card_id
    inner join public.dm2_card_sets cs on cs.id = c.card_set_id
    inner join public.pick_list_options sport on sport.id = cs.sport_id
    inner join public.dm2_brands b on b.id = cs.brand_id
    inner join public.dm2_manufacturers m on m.id = b.manufacturer_id
    inner join public.dm2_card_set_categories csc on csc.id = cs.card_set_category_id
    inner join public.dm2_card_set_names csn on csn.id = cs.card_set_name_id
    left join public.dm2_parallels p on p.id = c.parallel_id
    where auth.uid() is not null
      and cp.player_id = p_player_id
      and c.active = true
      and cs.active = true
  )
  select
    m.*,
    count(*) over() as total_count
  from matched m
  order by m.year desc, m.card_set_name asc, m.card_number asc
  limit least(greatest(coalesce(lim, 24), 1), 100)
  offset greatest(coalesce(row_offset, 0), 0);
$$;

revoke all on function public.get_dm2_cards_for_player(uuid, int, int) from public;
grant execute on function public.get_dm2_cards_for_player(uuid, int, int) to authenticated;

alter table public.assets
  add column if not exists player_id uuid references public.dm2_players (id) on delete restrict;

create index if not exists assets_player_id_idx
  on public.assets (player_id);

notify pgrst, 'reload schema';
