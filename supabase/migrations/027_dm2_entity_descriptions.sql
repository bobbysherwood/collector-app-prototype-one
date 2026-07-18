-- Data Model v2: entity descriptions for AI Loader and schema documentation

create table if not exists public.dm2_entity_descriptions (
  entity_key text primary key,
  title text not null,
  description text not null,
  table_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm2_entity_descriptions_title_not_blank check (length(trim(title)) > 0),
  constraint dm2_entity_descriptions_description_not_blank check (length(trim(description)) > 0)
);

alter table public.dm2_entity_descriptions enable row level security;

drop policy if exists "Admins can view dm2 entity descriptions" on public.dm2_entity_descriptions;

create policy "Admins can view dm2 entity descriptions"
  on public.dm2_entity_descriptions
  for select
  to authenticated
  using (public.is_admin());

insert into public.dm2_entity_descriptions (entity_key, title, description, table_name, sort_order)
values
  (
    'sport',
    'Sport Table',
    'Stores the sport or collectible category associated with a card set. Use this table to classify the overall product, not the individual player. Typical values include Baseball, Basketball, Football, Hockey, Soccer, Golf, Tennis, Wrestling, Pokémon, Magic: The Gathering, etc.',
    'pick_list_options',
    10
  ),
  (
    'manufacturer',
    'Manufacturer Table',
    'Stores the company that produced the card product. This represents the parent manufacturer, not the product line. Examples include Panini, Topps, Upper Deck, Leaf, SkyBox, Fleer, Donruss, Bowman, Wild Card, etc.',
    'dm2_manufacturers',
    20
  ),
  (
    'brand',
    'Brand Table',
    'Stores the product line or brand produced by a manufacturer. Brands belong to a Manufacturer. Examples include Prizm, Select, Donruss Optic, Chrome, Finest, Bowman Chrome, Metal Universe, Stadium Club, National Treasures, Flawless, etc.',
    'dm2_brands',
    30
  ),
  (
    'card_set_category',
    'Card Set Category Table',
    'Stores the high-level classification of a card set within a product. Use this to categorize the purpose or type of checklist section. Typical values include Base Set, Insert, Sub-Set, Autograph, Memorabilia, Dual Autograph, Autograph Relic, Parallel, Promo, Case Hit, Variation, Redemption, etc.',
    'dm2_card_set_categories',
    40
  ),
  (
    'card_set_name',
    'Card Set Name Table',
    'Stores the specific checklist or insert name within a product. This is the manufacturer-defined name of the card set. Examples include Base Set, Downtown, Kaboom!, Planet Metal, All-Star, Alter Ego, Fireworks, Color Blast, Rookie Revolution, Net Marvels, etc.',
    'dm2_card_set_names',
    50
  ),
  (
    'parallel',
    'Parallel Table',
    'Stores the manufacturer-defined variation of a card within a Card Set. Use the published parallel name exactly as it appears on the checklist. Examples include Base, Silver, Gold, Gold Wave, Refractor, Blue Ice, Checkerboard, Aqua, Black Finite, Superfractor, Gold Medallion, PMG Green, etc. Do not normalize parallel names during import.',
    'dm2_parallels',
    60
  ),
  (
    'card_set',
    'Card Set Table',
    'Defines a unique checklist by combining Sport, Year, Manufacturer, Brand, Card Set Category, and Card Set Name. Every card checklist belongs to exactly one Card Set. Example: 2024 Basketball → Panini → Prizm → Insert → Fireworks or 1997 Basketball → SkyBox → Metal Universe → Insert → Planet Metal.',
    'dm2_card_sets',
    70
  ),
  (
    'cards',
    'Cards Table',
    'Stores the individual cards that belong to a Card Set. Each record represents one unique card variation and links a Card Set with a Parallel, Card #, and Player. Example: Card Set = 2024 Panini Prizm Basketball Fireworks, Card # = FW-1, Player = Victor Wembanyama, Parallel = Gold, or Card # = FW-1, Player = Victor Wembanyama, Parallel = Base.',
    'dm2_cards',
    80
  )
on conflict (entity_key) do update
set
  title = excluded.title,
  description = excluded.description,
  table_name = excluded.table_name,
  sort_order = excluded.sort_order,
  updated_at = now();

comment on table public.dm2_entity_descriptions is
  'Schema guidance for Data Model v2 entities. Used by the AI Loader to map imported checklist values to the correct tables.';

comment on table public.dm2_manufacturers is
  'Stores the company that produced the card product (parent manufacturer, not the product line). Examples: Panini, Topps, Upper Deck, Leaf, SkyBox, Fleer, Donruss, Bowman, Wild Card.';

comment on table public.dm2_brands is
  'Stores the product line or brand produced by a manufacturer. Brands belong to a Manufacturer. Examples: Prizm, Select, Donruss Optic, Chrome, Finest, Bowman Chrome, Metal Universe, Stadium Club, National Treasures, Flawless.';

comment on table public.dm2_card_set_categories is
  'High-level classification of a card set within a product (checklist section type). Examples: Base Set, Insert, Sub-Set, Autograph, Memorabilia, Dual Autograph, Autograph Relic, Parallel, Promo, Case Hit, Variation, Redemption.';

comment on table public.dm2_card_set_names is
  'Manufacturer-defined checklist or insert name within a product. Examples: Base Set, Downtown, Kaboom!, Planet Metal, All-Star, Alter Ego, Fireworks, Color Blast, Rookie Revolution, Net Marvels.';

comment on table public.dm2_parallels is
  'Manufacturer-defined variation of a card within a Card Set. Use published parallel names exactly as on the checklist. Examples: Base, Silver, Gold, Gold Wave, Refractor, Blue Ice, Checkerboard, Aqua, Black Finite, Superfractor, Gold Medallion, PMG Green. Do not normalize during import.';

comment on table public.dm2_card_sets is
  'Unique checklist defined by Sport + Year + Manufacturer + Brand + Card Set Category + Card Set Name. Example: 2024 Basketball → Panini → Prizm → Insert → Fireworks.';

comment on table public.dm2_cards is
  'Individual cards in a Card Set. Each record is one unique card variation: Card Set + Parallel + Card # + Player. Example: FW-1 Victor Wembanyama Gold in 2024 Panini Prizm Basketball Fireworks.';
