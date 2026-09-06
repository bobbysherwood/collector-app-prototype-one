-- Allow signed-in users to fill empty catalog profile fields from public bio.
-- Never overwrites an existing birth year, team, or career status.

create or replace function public.fill_dm2_player_profile_if_empty(
  p_player_id uuid,
  p_birth_year integer default null,
  p_team text default null,
  p_career_status text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_career_status is not null
     and p_career_status not in ('prospect', 'active', 'retired', 'deceased') then
    raise exception 'invalid career status';
  end if;

  update public.dm2_players
  set
    birth_year = coalesce(birth_year, p_birth_year),
    team = coalesce(nullif(btrim(team), ''), nullif(btrim(coalesce(p_team, '')), '')),
    career_status = coalesce(career_status, p_career_status),
    updated_at = now()
  where id = p_player_id
    and (
      (birth_year is null and p_birth_year is not null)
      or (
        (team is null or btrim(team) = '')
        and p_team is not null
        and btrim(p_team) <> ''
      )
      or (career_status is null and p_career_status is not null)
    );

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

revoke all on function public.fill_dm2_player_profile_if_empty(uuid, integer, text, text) from public;
grant execute on function public.fill_dm2_player_profile_if_empty(uuid, integer, text, text) to authenticated;
