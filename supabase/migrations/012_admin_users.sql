-- Admin user management support

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.profiles
  add column if not exists active boolean not null default true,
  add column if not exists last_login_at timestamptz;

create or replace function public.admin_list_users()
returns table (
  id uuid,
  username text,
  email text,
  active boolean,
  last_login_at timestamptz,
  role public.user_role
)
language sql
security definer
set search_path = ''
as $$
  select
    p.id,
    coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as username,
    p.email,
    p.active,
    coalesce(p.last_login_at, u.last_sign_in_at) as last_login_at,
    p.role
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at desc;
$$;

create or replace function public.admin_update_user(
  p_user_id uuid,
  p_display_name text default null,
  p_role public.user_role default null,
  p_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  update public.profiles
  set
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
    role = coalesce(p_role, role),
    active = coalesce(p_active, active)
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin() or auth.uid() = id);

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin());

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

revoke all on function public.admin_update_user(uuid, text, public.user_role, boolean) from public;
grant execute on function public.admin_update_user(uuid, text, public.user_role, boolean) to authenticated;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
