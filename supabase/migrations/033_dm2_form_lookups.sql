-- Read-only DM2 lookup lists for authenticated users (add-card manual form)

create or replace function public.get_dm2_card_form_lookups()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    else jsonb_build_object(
      'manufacturers', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', m.id, 'name', m.name)
          order by m.name
        )
        from public.dm2_manufacturers m
        where m.active = true
      ), '[]'::jsonb),
      'brands', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'manufacturer_id', b.manufacturer_id
          )
          order by b.name
        )
        from public.dm2_brands b
        where b.active = true
      ), '[]'::jsonb),
      'card_set_categories', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', c.id, 'name', c.name)
          order by c.name
        )
        from public.dm2_card_set_categories c
        where c.active = true
      ), '[]'::jsonb),
      'card_set_names', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', n.id, 'name', n.name)
          order by n.name
        )
        from public.dm2_card_set_names n
        where n.active = true
      ), '[]'::jsonb),
      'parallels', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', p.id, 'name', p.name)
          order by p.name
        )
        from public.dm2_parallels p
        where p.active = true
      ), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.get_dm2_card_form_lookups() from public;
grant execute on function public.get_dm2_card_form_lookups() to authenticated;
