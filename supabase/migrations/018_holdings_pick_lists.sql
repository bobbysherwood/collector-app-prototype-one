-- Holdings pick list options (admin-managed dropdown values)

create type public.pick_list_category as enum (
  'card_type',
  'sport',
  'grader',
  'grade'
);

create table public.pick_list_options (
  id uuid primary key default gen_random_uuid(),
  category public.pick_list_category not null,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pick_list_options_label_not_blank check (length(trim(label)) > 0)
);

create unique index pick_list_options_category_label_unique
  on public.pick_list_options (category, lower(trim(label)));

create index pick_list_options_category_sort_idx
  on public.pick_list_options (category, sort_order, label);

alter table public.pick_list_options enable row level security;

create policy "Users can read active pick list options"
  on public.pick_list_options
  for select
  to authenticated
  using (active = true or public.is_admin());

create policy "Admins can insert pick list options"
  on public.pick_list_options
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update pick list options"
  on public.pick_list_options
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete pick list options"
  on public.pick_list_options
  for delete
  to authenticated
  using (public.is_admin());

insert into public.pick_list_options (category, label, sort_order) values
  ('card_type', 'Topps', 1),
  ('card_type', 'Topps Chrome', 2),
  ('card_type', 'Bowman', 3),
  ('card_type', 'Bowman Chrome', 4),
  ('card_type', 'Panini', 5),
  ('card_type', 'Select', 6),
  ('card_type', 'Mosaic', 7),
  ('card_type', 'Prizm', 8),
  ('card_type', 'Donruss', 9),
  ('card_type', 'Upper Deck', 10),
  ('card_type', 'Fleer', 11),
  ('card_type', 'Other', 12),
  ('sport', 'Baseball', 1),
  ('sport', 'Basketball', 2),
  ('sport', 'Football', 3),
  ('sport', 'Hockey', 4),
  ('sport', 'Pokemon', 5),
  ('sport', 'Soccer', 6),
  ('sport', 'Other', 7),
  ('grader', 'PSA', 1),
  ('grader', 'BGS', 2),
  ('grader', 'SGC', 3),
  ('grader', 'CGC', 4),
  ('grader', 'Raw', 5),
  ('grade', '10', 1),
  ('grade', '9.5', 2),
  ('grade', '9', 3),
  ('grade', '8.5', 4),
  ('grade', '8', 5),
  ('grade', '7.5', 6),
  ('grade', '7', 7),
  ('grade', '6.5', 8),
  ('grade', '6', 9),
  ('grade', '5', 10),
  ('grade', '4', 11),
  ('grade', '3', 12),
  ('grade', '2', 13),
  ('grade', '1', 14),
  ('grade', 'Authentic', 15);
