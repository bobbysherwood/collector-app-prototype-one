-- Subset numbering: within base range OR appended after base range

insert into public.dm2_entity_descriptions (entity_key, title, description, table_name, sort_order)
values
  (
    'card_set_category',
    'Card Set Category Table',
    'Stores the high-level classification of a card set within a product. Key values: Base Set — the foundational sequential checklist (e.g., cards 1-300); Subset — a specialized group using the same sequential base checklist numbering, either within the base range (e.g., Rated Rookies #201-250 of 300) or appended at the end (e.g., Rated Rookies #301-350 after a 300-card base; file may say "Base Rated Rookies"); Insert — a separate checklist outside main base numbering (e.g., IN1-IN15, FW-1, or standalone 1-12). Also: Autograph, Memorabilia, Promo, Case Hit, Variation, Redemption, etc.',
    'dm2_card_set_categories',
    40
  )
on conflict (entity_key) do update
set
  description = excluded.description,
  updated_at = now();

comment on table public.dm2_card_set_categories is
  'High-level classification of a card set within a product. Base Set = main sequential checklist; Subset = specialized group using base checklist numbering within the range (e.g., Rated Rookies #201-250) or appended after it (e.g., #301-350); Insert = separate numbering (IN1, FW-1, etc.).';
