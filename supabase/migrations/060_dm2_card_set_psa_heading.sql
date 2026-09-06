-- PSA population report heading for one catalog card set.
-- Example: https://www.psacard.com/pop/basketball-cards/2017/panini-donruss-rookies/154126
-- stores 154126. This is an address, not a live scrape credential.

alter table public.dm2_card_sets
  add column if not exists psa_heading_id integer;

create unique index if not exists dm2_card_sets_psa_heading_id_uidx
  on public.dm2_card_sets (psa_heading_id)
  where psa_heading_id is not null;

comment on column public.dm2_card_sets.psa_heading_id is
  'PSA Population Report heading id for this card set. Used to identify the set census page; population counts are ingested from captured JSON, not fetched live.';
