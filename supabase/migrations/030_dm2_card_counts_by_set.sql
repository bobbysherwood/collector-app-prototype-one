-- Aggregated card counts per card set for admin UI (avoids scanning all dm2_cards rows)

create or replace view public.dm2_card_counts_by_set
with (security_invoker = true)
as
select
  card_set_id,
  count(*)::integer as card_count
from public.dm2_cards
group by card_set_id;

grant select on public.dm2_card_counts_by_set to authenticated;
