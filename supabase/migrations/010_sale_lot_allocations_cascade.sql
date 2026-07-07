-- Deleting lots or assets should remove related sale allocations.
alter table public.sale_lot_allocations
  drop constraint if exists sale_lot_allocations_lot_id_fkey;

alter table public.sale_lot_allocations
  add constraint sale_lot_allocations_lot_id_fkey
  foreign key (lot_id) references public.lots on delete cascade;

create policy "Users can delete own sale lot allocations"
  on public.sale_lot_allocations for delete
  using (
    exists (
      select 1 from public.lots l
      where l.id = lot_id and l.user_id = auth.uid()
    )
  );
