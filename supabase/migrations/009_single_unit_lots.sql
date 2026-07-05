-- Enforce one physical card per lot (quantity always 1).
-- Splits any existing multi-quantity lots into individual lots.

-- ---------------------------------------------------------------------------
-- Split lots with quantity_acquired > 1
-- ---------------------------------------------------------------------------
do $$
declare
  lot_rec record;
  sub_lot_ids uuid[];
  sub_id uuid;
  i int;
  sold_count int;
  alloc_rec record;
  lot_index int;
  j int;
begin
  for lot_rec in
    select * from public.lots
    where quantity_acquired > 1
    order by created_at
  loop
    sold_count := lot_rec.quantity_acquired - lot_rec.quantity_remaining;
    sub_lot_ids := array[lot_rec.id];

    for i in 2..lot_rec.quantity_acquired loop
      sub_id := gen_random_uuid();
      insert into public.lots (
        id,
        asset_id,
        user_id,
        purchase_date,
        unit_cost,
        quantity_acquired,
        quantity_remaining,
        grader,
        grade,
        cert_number,
        notes,
        created_at
      ) values (
        sub_id,
        lot_rec.asset_id,
        lot_rec.user_id,
        lot_rec.purchase_date,
        lot_rec.unit_cost,
        1,
        0,
        lot_rec.grader,
        lot_rec.grade,
        lot_rec.cert_number,
        lot_rec.notes,
        lot_rec.created_at
      );
      sub_lot_ids := array_append(sub_lot_ids, sub_id);
    end loop;

    for i in 1..array_length(sub_lot_ids, 1) loop
      update public.lots
      set
        quantity_acquired = 1,
        quantity_remaining = case when i > sold_count then 1 else 0 end
      where id = sub_lot_ids[i];
    end loop;

    lot_index := 1;
    for alloc_rec in
      select *
      from public.sale_lot_allocations
      where lot_id = lot_rec.id
      order by created_at
    loop
      update public.sale_lot_allocations
      set lot_id = sub_lot_ids[lot_index], quantity = 1
      where id = alloc_rec.id;
      lot_index := lot_index + 1;

      for j in 2..alloc_rec.quantity loop
        insert into public.sale_lot_allocations (
          sale_id,
          lot_id,
          quantity,
          unit_cost
        ) values (
          alloc_rec.sale_id,
          sub_lot_ids[lot_index],
          1,
          alloc_rec.unit_cost
        );
        lot_index := lot_index + 1;
      end loop;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Constraints: one card per lot
-- ---------------------------------------------------------------------------
alter table public.lots
  drop constraint if exists lots_remaining_lte_acquired;

alter table public.lots
  add constraint lots_single_unit_acquired
  check (quantity_acquired = 1);

alter table public.lots
  add constraint lots_single_unit_remaining
  check (quantity_remaining in (0, 1));

alter table public.sale_lot_allocations
  add constraint sale_lot_allocations_single_unit
  check (quantity = 1);
