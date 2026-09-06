-- Precompute backfill candidates in batches so the admin UI does not scan every card.

create table if not exists public.dm2_player_backfill_candidates (
  sport_id uuid not null,
  sport_label text not null,
  name text not null,
  name_key text not null,
  card_count bigint not null default 0,
  primary key (sport_id, name_key)
);

alter table public.dm2_player_backfill_candidates enable row level security;

drop policy if exists "Admins can read player backfill candidates" on public.dm2_player_backfill_candidates;
drop policy if exists "Admins can insert player backfill candidates" on public.dm2_player_backfill_candidates;
drop policy if exists "Admins can update player backfill candidates" on public.dm2_player_backfill_candidates;
drop policy if exists "Admins can delete player backfill candidates" on public.dm2_player_backfill_candidates;

create policy "Admins can read player backfill candidates"
  on public.dm2_player_backfill_candidates
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert player backfill candidates"
  on public.dm2_player_backfill_candidates
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update player backfill candidates"
  on public.dm2_player_backfill_candidates
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete player backfill candidates"
  on public.dm2_player_backfill_candidates
  for delete
  to authenticated
  using (public.is_admin());

create or replace function public.start_dm2_player_backfill_refresh()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  truncate public.dm2_player_backfill_candidates;
end;
$$;

revoke all on function public.start_dm2_player_backfill_refresh() from public;
grant execute on function public.start_dm2_player_backfill_refresh() to authenticated;

create or replace function public.refresh_dm2_player_backfill_batch(
  p_after_card_id uuid default null,
  p_limit int default 4000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_limit int := least(greatest(coalesce(p_limit, 4000), 1), 8000);
  processed int := 0;
  last_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  select s.id, s.processed
  into last_id, processed
  from (
    select
      c.id,
      count(*) over()::int as processed
    from public.dm2_cards c
    where c.player is not null
      and length(trim(c.player)) > 0
      and (p_after_card_id is null or c.id > p_after_card_id)
    order by c.id
    limit batch_limit
  ) s
  order by s.id desc
  limit 1;

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
  where c.player is not null
    and length(trim(c.player)) > 0
    and (p_after_card_id is null or c.id > p_after_card_id)
    and c.id <= last_id
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

revoke all on function public.refresh_dm2_player_backfill_batch(uuid, int) from public;
grant execute on function public.refresh_dm2_player_backfill_batch(uuid, int) to authenticated;

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
  order by c.sport_label, c.name;
$$;

revoke all on function public.list_dm2_player_backfill_candidates() from public;
grant execute on function public.list_dm2_player_backfill_candidates() to authenticated;

notify pgrst, 'reload schema';
