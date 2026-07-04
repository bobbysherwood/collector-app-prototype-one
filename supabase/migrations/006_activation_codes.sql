-- Single-use activation codes for restricted signup (1001-1100)

create table public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users on delete set null,
  notes text
);

create index activation_codes_code_idx on public.activation_codes (code);
create index activation_codes_unused_idx
  on public.activation_codes (code)
  where used_at is null;

alter table public.activation_codes enable row level security;

insert into public.activation_codes (code)
select i::text
from generate_series(1001, 1100) as i;

create or replace function public.check_activation_code_available(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $func$
begin
  if p_code is null or p_code !~ '^[0-9]{4}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.activation_codes
    where code = p_code
      and used_at is null
  );
end;
$func$;

create or replace function public.consume_activation_code(
  p_code text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $func$
declare
  v_updated boolean := false;
begin
  if p_code is null or p_code !~ '^[0-9]{4}$' or p_user_id is null then
    return false;
  end if;

  update public.activation_codes
  set used_at = now(),
      used_by = p_user_id
  where code = p_code
    and used_at is null;

  v_updated := found;
  return v_updated;
end;
$func$;

revoke all on function public.check_activation_code_available(text) from public;
grant execute on function public.check_activation_code_available(text) to anon, authenticated;

revoke all on function public.consume_activation_code(text, uuid) from public;
grant execute on function public.consume_activation_code(text, uuid) to anon, authenticated;
