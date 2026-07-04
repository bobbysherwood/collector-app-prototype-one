-- STEP 1: Run this first in Supabase SQL Editor

create unique index if not exists profiles_display_name_unique_idx
  on public.profiles (lower(trim(display_name)))
  where display_name is not null and trim(display_name) <> '';

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(trim(email)));
