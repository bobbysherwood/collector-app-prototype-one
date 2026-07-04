-- STEP 2: Run this second (after step 1 succeeds)

create or replace function public.check_signup_availability(
  p_email text,
  p_display_name text
)
returns json
language plpgsql
security definer
set search_path = ''
as $func$
declare
  v_email_taken boolean := false;
  v_display_name_taken boolean := false;
  v_normalized_email text := lower(trim(p_email));
  v_normalized_display_name text := lower(trim(p_display_name));
begin
  if v_normalized_email <> '' then
    select exists (
      select 1
      from auth.users
      where lower(trim(email)) = v_normalized_email
    ) into v_email_taken;

    if not v_email_taken then
      select exists (
        select 1
        from public.profiles
        where lower(trim(email)) = v_normalized_email
      ) into v_email_taken;
    end if;
  end if;

  if v_normalized_display_name <> '' then
    select exists (
      select 1
      from public.profiles
      where lower(trim(display_name)) = v_normalized_display_name
    ) into v_display_name_taken;
  end if;

  return json_build_object(
    'email_available', not v_email_taken,
    'display_name_available', not v_display_name_taken
  );
end;
$func$;

revoke all on function public.check_signup_availability(text, text) from public;
grant execute on function public.check_signup_availability(text, text) to anon, authenticated;
