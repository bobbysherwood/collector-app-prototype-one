-- User roles for admin access
create type public.user_role as enum ('user', 'admin');

alter table public.profiles
  add column role public.user_role not null default 'user';

-- Assign admin role to Bobby Sherwood
update public.profiles
set role = 'admin'
where display_name = 'Bobby Sherwood';
