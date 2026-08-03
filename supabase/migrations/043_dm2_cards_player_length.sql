-- Multi-player checklist cards (e.g. Rookie Sweaters Header Checklist) exceed 100 chars.

alter table public.dm2_cards
  alter column player type varchar(1000);
