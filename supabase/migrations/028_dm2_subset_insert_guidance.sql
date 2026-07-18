-- Clarify Base Set vs Subset vs Insert taxonomy for AI Loader entity descriptions

insert into public.dm2_entity_descriptions (entity_key, title, description, table_name, sort_order)
values
  (
    'card_set_category',
    'Card Set Category Table',
    'Stores the high-level classification of a card set within a product. Key values: Base Set — the foundational sequential checklist (e.g., cards 1-300); Subset — a specialized group using the same sequential base checklist numbering, either within the base range (e.g., Rated Rookies #201-250 of 300) or appended at the end (e.g., Rated Rookies #301-350 after a 300-card base; file may say "Base Rated Rookies"); Insert — a separate checklist outside main base numbering (e.g., IN1-IN15, FW-1, or standalone 1-12). Also: Autograph, Memorabilia, Promo, Case Hit, Variation, Redemption, etc.',
    'dm2_card_set_categories',
    40
  ),
  (
    'card_set_name',
    'Card Set Name Table',
    'Stores the manufacturer-defined checklist section title within a product. Examples: Base Set (main checklist), Rated Rookies (subset within base numbering), Downtown, Kaboom!, Alter Ego, Fireworks (inserts). When a file combines words like "Base Rated Rookies", the set name is usually "Rated Rookies" and the category is Subset — not Base Set.',
    'dm2_card_set_names',
    50
  ),
  (
    'card_set',
    'Card Set Table',
    'Defines a unique checklist by combining Sport, Year, Manufacturer, Brand, Card Set Category, and Card Set Name. Example subset: 2024 Basketball → Panini → Donruss Optic → Subset → Rated Rookies. Example insert: 2024 Basketball → Panini → Prizm → Insert → Fireworks.',
    'dm2_card_sets',
    70
  )
on conflict (entity_key) do update
set
  title = excluded.title,
  description = excluded.description,
  table_name = excluded.table_name,
  sort_order = excluded.sort_order,
  updated_at = now();

comment on table public.dm2_card_set_categories is
  'High-level classification of a card set within a product. Base Set = main sequential checklist; Subset = specialized group using base checklist numbering within the range (e.g., Rated Rookies #201-250) or appended after it (e.g., #301-350); Insert = separate numbering (IN1, FW-1, etc.).';

comment on table public.dm2_card_set_names is
  'Manufacturer-defined checklist section title. Examples: Base Set, Rated Rookies (subset), Downtown, Alter Ego, Fireworks (inserts). "Base Rated Rookies" → name Rated Rookies, category Subset.';

comment on table public.dm2_card_sets is
  'Unique checklist defined by Sport + Year + Manufacturer + Brand + Card Set Category + Card Set Name. Example subset: Panini Donruss Optic Subset Rated Rookies. Example insert: Panini Prizm Insert Fireworks.';
