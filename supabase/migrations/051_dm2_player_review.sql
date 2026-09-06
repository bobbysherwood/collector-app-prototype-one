-- Aliases for merged near-duplicate spellings, plus batched card linking.

create extension if not exists fuzzystrmatch;

create table if not exists public.dm2_player_aliases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.dm2_players (id) on delete cascade,
  sport_id uuid not null references public.pick_list_options (id) on delete restrict,
  name varchar(200) not null,
  name_key text generated always as (lower(trim(name))) stored,
  created_at timestamptz not null default now(),
  constraint dm2_player_aliases_name_not_blank check (length(trim(name)) > 0),
  constraint dm2_player_aliases_sport_name_unique unique (sport_id, name_key)
);

create index if not exists dm2_player_aliases_player_id_idx
  on public.dm2_player_aliases (player_id);

alter table public.dm2_player_aliases enable row level security;

drop policy if exists "Users can read player aliases" on public.dm2_player_aliases;
drop policy if exists "Admins can insert player aliases" on public.dm2_player_aliases;
drop policy if exists "Admins can delete player aliases" on public.dm2_player_aliases;

create policy "Users can read player aliases"
  on public.dm2_player_aliases
  for select
  to authenticated
  using (true);

create policy "Admins can insert player aliases"
  on public.dm2_player_aliases
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can delete player aliases"
  on public.dm2_player_aliases
  for delete
  to authenticated
  using (public.is_admin());

create or replace function public.link_dm2_card_players_batch(
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
  links_created int := 0;
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
    where c.player is not null
      and length(trim(c.player)) > 0
      and (p_after_card_id is null or c.id > p_after_card_id)
      and c.id <= last_id
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

revoke all on function public.link_dm2_card_players_batch(uuid, int) from public;
grant execute on function public.link_dm2_card_players_batch(uuid, int) to authenticated;

notify pgrst, 'reload schema';
