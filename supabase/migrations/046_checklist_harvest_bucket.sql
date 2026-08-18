-- Private bucket for checklist harvest staging/approved files
-- Service role writes; authenticated admins read (optional V1.1)
insert into storage.buckets (id, name, public)
values ('checklist-harvest', 'checklist-harvest', false)
on conflict (id) do nothing;
