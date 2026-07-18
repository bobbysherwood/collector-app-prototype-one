import { createClient } from "@/lib/supabase/server";
import type {
  Dm2Brand,
  Dm2Card,
  Dm2CardSet,
  Dm2CardSetCategory,
  Dm2CardSetName,
  Dm2EntityDescription,
  Dm2Manufacturer,
  Dm2Parallel,
} from "@/types/data-model-v2";

export async function getDm2EntityDescriptions(): Promise<Dm2EntityDescription[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dm2_entity_descriptions")
    .select("entity_key, title, description, table_name, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to load dm2 entity descriptions:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    entityKey: row.entity_key,
    title: row.title,
    description: row.description,
    tableName: row.table_name ?? undefined,
    sortOrder: row.sort_order,
  }));
}

function mapNameLookupRow(row: {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}): Dm2CardSetCategory | Dm2CardSetName | Dm2Manufacturer | Dm2Parallel {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function getDm2CardSetCategories(): Promise<Dm2CardSetCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dm2_card_set_categories")
    .select("id, name, active, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load card set categories:", error.message);
    return [];
  }

  return (data ?? []).map(mapNameLookupRow);
}

export async function getDm2CardSetNames(): Promise<Dm2CardSetName[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dm2_card_set_names")
    .select("id, name, active, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load card set names:", error.message);
    return [];
  }

  return (data ?? []).map(mapNameLookupRow);
}

export async function getDm2Manufacturers(): Promise<Dm2Manufacturer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dm2_manufacturers")
    .select("id, name, active, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load manufacturers:", error.message);
    return [];
  }

  return (data ?? []).map(mapNameLookupRow);
}

function readRelatedName(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first?.name === "string" ? first.name : "";
  }
  if (value && typeof value === "object" && "name" in value) {
    return typeof value.name === "string" ? value.name : "";
  }
  return "";
}

function mapBrandRow(row: {
  id: string;
  name: string;
  manufacturer_id: string;
  active: boolean;
  created_at: string;
  dm2_manufacturers: unknown;
}): Dm2Brand {
  return {
    id: row.id,
    name: row.name,
    manufacturerId: row.manufacturer_id,
    manufacturerName: readRelatedName(row.dm2_manufacturers),
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function getDm2Brands(): Promise<Dm2Brand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dm2_brands")
    .select("id, name, manufacturer_id, active, created_at, dm2_manufacturers(name)")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load brands:", error.message);
    return [];
  }

  return (data ?? []).map(mapBrandRow);
}

export async function getDm2Parallels(): Promise<Dm2Parallel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dm2_parallels")
    .select("id, name, active, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load parallels:", error.message);
    return [];
  }

  return (data ?? []).map(mapNameLookupRow);
}

function readPickListLabel(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first?.label === "string" ? first.label : "";
  }
  if (value && typeof value === "object" && "label" in value) {
    return typeof value.label === "string" ? value.label : "";
  }
  return "";
}

function readBrandRelation(value: unknown): {
  name: string;
  manufacturerName: string;
} {
  if (Array.isArray(value)) {
    const first = value[0];
    if (!first || typeof first !== "object") {
      return { name: "", manufacturerName: "" };
    }
    return {
      name: typeof first.name === "string" ? first.name : "",
      manufacturerName: readRelatedName(first.dm2_manufacturers),
    };
  }
  if (value && typeof value === "object" && "name" in value) {
    const record = value as { name?: string; dm2_manufacturers?: unknown };
    return {
      name: typeof record.name === "string" ? record.name : "",
      manufacturerName: readRelatedName(record.dm2_manufacturers),
    };
  }
  return { name: "", manufacturerName: "" };
}

function mapCardSetRow(row: {
  id: string;
  sport_id: string;
  year: number;
  brand_id: string;
  card_set_category_id: string;
  card_set_name_id: string;
  active: boolean;
  created_at: string;
  pick_list_options: unknown;
  dm2_brands: unknown;
  dm2_card_set_categories: unknown;
  dm2_card_set_names: unknown;
}): Dm2CardSet {
  const brand = readBrandRelation(row.dm2_brands);

  return {
    id: row.id,
    sportId: row.sport_id,
    sportName: readPickListLabel(row.pick_list_options),
    year: row.year,
    brandId: row.brand_id,
    brandName: brand.name,
    manufacturerName: brand.manufacturerName,
    cardSetCategoryId: row.card_set_category_id,
    cardSetCategoryName: readRelatedName(row.dm2_card_set_categories),
    cardSetNameId: row.card_set_name_id,
    cardSetName: readRelatedName(row.dm2_card_set_names),
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function getDm2CardSets(): Promise<Dm2CardSet[]> {
  const supabase = await createClient();
  const cardSetSelect =
    "id, sport_id, year, brand_id, card_set_category_id, card_set_name_id, active, created_at, pick_list_options(label), dm2_brands(name, dm2_manufacturers(name)), dm2_card_set_categories(name), dm2_card_set_names(name)";

  const data = await fetchAllSupabasePages<Parameters<typeof mapCardSetRow>[0]>(
    "dm2 card sets",
    async (from, to) =>
      supabase
        .from("dm2_card_sets")
        .select(cardSetSelect)
        .order("year", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to)
  );

  return data.map(mapCardSetRow);
}

export function formatDm2CardSetLabel(cardSet: {
  year: number;
  sportName: string;
  manufacturerName: string;
  brandName: string;
  cardSetName: string;
}): string {
  return `${cardSet.year} ${cardSet.sportName} · ${cardSet.manufacturerName} | ${cardSet.brandName} · ${cardSet.cardSetName}`;
}

function mapCardRow(row: {
  id: string;
  card_set_id: string;
  card_number: string;
  player: string;
  parallel_id: string | null;
  active: boolean;
  created_at: string;
  dm2_card_sets: unknown;
  dm2_parallels: unknown;
}): Dm2Card {
  const cardSetData = Array.isArray(row.dm2_card_sets)
    ? row.dm2_card_sets[0]
    : row.dm2_card_sets;

  let cardSetLabel = "";
  if (cardSetData && typeof cardSetData === "object") {
    const record = cardSetData as {
      year?: number;
      pick_list_options?: unknown;
      dm2_brands?: unknown;
      dm2_card_set_names?: unknown;
    };
    const brand = readBrandRelation(record.dm2_brands);
    cardSetLabel = formatDm2CardSetLabel({
      year: typeof record.year === "number" ? record.year : 0,
      sportName: readPickListLabel(record.pick_list_options),
      manufacturerName: brand.manufacturerName,
      brandName: brand.name,
      cardSetName: readRelatedName(record.dm2_card_set_names),
    });
  }

  const parallelName = row.parallel_id
    ? readRelatedName(row.dm2_parallels) || null
    : null;

  return {
    id: row.id,
    cardSetId: row.card_set_id,
    cardSetLabel,
    cardNumber: row.card_number,
    player: row.player,
    parallelId: row.parallel_id,
    parallelName,
    active: row.active,
    createdAt: row.created_at,
  };
}

const DM2_SUPABASE_PAGE_SIZE = 1000;

async function fetchAllSupabasePages<T>(
  label: string,
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + DM2_SUPABASE_PAGE_SIZE - 1);
    if (error) {
      console.error(`Failed to load ${label}:`, error.message);
      break;
    }
    if (!data?.length) break;

    all.push(...data);
    if (data.length < DM2_SUPABASE_PAGE_SIZE) break;
    from += DM2_SUPABASE_PAGE_SIZE;
  }

  return all;
}

export async function getDm2CardCountsBySetId(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const counts: Record<string, number> = {};

  const rows = await fetchAllSupabasePages<{
    card_set_id: string;
    card_count: number;
  }>("dm2 card counts", async (from, to) =>
    supabase
      .from("dm2_card_counts_by_set")
      .select("card_set_id, card_count")
      .order("card_set_id", { ascending: true })
      .range(from, to)
  );

  for (const row of rows) {
    counts[row.card_set_id] = row.card_count;
  }

  return counts;
}

export async function getDm2CardsBySetId(cardSetId: string): Promise<Dm2Card[]> {
  const supabase = await createClient();
  const cardSelect =
    "id, card_set_id, card_number, player, parallel_id, active, created_at, dm2_card_sets(year, pick_list_options(label), dm2_brands(name, dm2_manufacturers(name)), dm2_card_set_names(name)), dm2_parallels(name)";

  const data = await fetchAllSupabasePages<Parameters<typeof mapCardRow>[0]>(
    `dm2 cards for set ${cardSetId}`,
    async (from, to) =>
      supabase
        .from("dm2_cards")
        .select(cardSelect)
        .eq("card_set_id", cardSetId)
        .order("created_at", { ascending: false })
        .range(from, to)
  );

  return data.map(mapCardRow);
}

export async function getDm2Cards(): Promise<Dm2Card[]> {
  const supabase = await createClient();
  const cardSelect =
    "id, card_set_id, card_number, player, parallel_id, active, created_at, dm2_card_sets(year, pick_list_options(label), dm2_brands(name, dm2_manufacturers(name)), dm2_card_set_names(name)), dm2_parallels(name)";

  const data = await fetchAllSupabasePages<Parameters<typeof mapCardRow>[0]>(
    "dm2 cards",
    async (from, to) =>
      supabase
        .from("dm2_cards")
        .select(cardSelect)
        .order("created_at", { ascending: false })
        .range(from, to)
  );

  return data.map(mapCardRow);
}
