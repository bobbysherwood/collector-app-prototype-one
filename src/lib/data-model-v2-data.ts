import { TtlCache } from "@/lib/player-stats/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  Dm2Brand,
  Dm2Card,
  Dm2CardFormLookups,
  Dm2CardSet,
  Dm2CardSetCategory,
  Dm2CardSetName,
  Dm2EntityDescription,
  Dm2Attribute,
  Dm2Manufacturer,
  Dm2Parallel,
  Dm2Player,
  Dm2ComparableCandidate,
  Dm2CardAttributeAssignment,
} from "@/types/data-model-v2";
import { EMPTY_DM2_CARD_FORM_LOOKUPS } from "@/types/data-model-v2";

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
}): Dm2CardSetCategory | Dm2CardSetName | Dm2Manufacturer | Dm2Parallel | Dm2Attribute {
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

const DM2_PLAYER_BASE_SELECT =
  "id, sport_id, name, image_path, active, created_at, pick_list_options(label)";
const DM2_PLAYER_PROFILE_SELECT =
  "id, sport_id, name, image_path, active, created_at, birth_year, career_status, injury_status, team, pick_list_options(label)";

export function isMissingPlayerProfileColumn(message: string): boolean {
  return /birth_year|career_status|injury_status|column .* does not exist/i.test(message);
}

type Dm2PlayerRow = {
  id: string;
  sport_id: string;
  name: string;
  image_path: string | null;
  active: boolean;
  created_at: string;
  birth_year?: number | null;
  career_status?: "prospect" | "active" | "retired" | "deceased" | null;
  injury_status?: "healthy" | "injured" | null;
  team?: string | null;
  pick_list_options: { label?: string } | { label?: string }[] | null;
  dm2_card_players?: { count: number }[] | { count: number } | null;
};

export function mapDm2PlayerRow(row: Dm2PlayerRow): Dm2Player {
  return {
    id: row.id,
    sportId: row.sport_id,
    sportName: readPickListLabel(row.pick_list_options),
    name: row.name,
    imagePath: row.image_path ?? null,
    active: row.active,
    createdAt: row.created_at,
    birthYear: row.birth_year ?? null,
    careerStatus: row.career_status ?? null,
    injuryStatus: row.injury_status ?? null,
    team: row.team ?? null,
  };
}

function readEmbeddedCount(
  value: { count: number }[] | { count: number } | null | undefined
): number {
  if (Array.isArray(value)) return Number(value[0]?.count ?? 0);
  if (value && typeof value === "object" && "count" in value) {
    return Number(value.count ?? 0);
  }
  return 0;
}

export async function resolveDm2PlayerSelect(): Promise<string> {
  const supabase = await createClient();
  const probe = await supabase
    .from("dm2_players")
    .select(DM2_PLAYER_PROFILE_SELECT)
    .order("name", { ascending: true })
    .range(0, 0);

  if (probe.error && isMissingPlayerProfileColumn(probe.error.message)) {
    console.warn(
      "dm2_players profile columns are missing. Run supabase/migrations/055_dm2_player_profile.sql in the Supabase SQL editor."
    );
    return DM2_PLAYER_BASE_SELECT;
  }

  return DM2_PLAYER_PROFILE_SELECT;
}

export function dm2PlayerSelectHasProfileColumns(select: string): boolean {
  return select.includes("birth_year");
}

export async function listDm2PlayersMissingBirthYear(
  limit = 50
): Promise<{ error?: string; players: Dm2Player[] }> {
  const supabase = await createClient();
  const select = await resolveDm2PlayerSelect();
  if (!dm2PlayerSelectHasProfileColumns(select)) {
    return {
      error:
        "dm2_players profile columns are missing. Run supabase/migrations/055_dm2_player_profile.sql in the Supabase SQL editor.",
      players: [],
    };
  }

  const { data, error } = await supabase
    .from("dm2_players")
    .select(select)
    .is("birth_year", null)
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 50)));

  if (error) {
    if (isMissingPlayerProfileColumn(error.message)) {
      return {
        error:
          "dm2_players profile columns are missing. Run supabase/migrations/055_dm2_player_profile.sql in the Supabase SQL editor.",
        players: [],
      };
    }
    return { error: error.message, players: [] };
  }

  return {
    players: (data as unknown as Dm2PlayerRow[] | null)?.map(mapDm2PlayerRow) ?? [],
  };
}

export async function updateDm2PlayerEmptyProfileFields(
  playerId: string,
  patch: { birth_year?: number; team?: string; career_status?: string }
): Promise<{ error?: string; wrote: boolean }> {
  if (Object.keys(patch).length === 0) return { wrote: false };

  const supabase = await createClient();
  const rpc = await supabase.rpc("fill_dm2_player_profile_if_empty", {
    p_player_id: playerId,
    p_birth_year: patch.birth_year ?? null,
    p_team: patch.team ?? null,
    p_career_status: patch.career_status ?? null,
  });

  if (!rpc.error) {
    return { wrote: Boolean(rpc.data) };
  }

  if (/could not find the function|schema cache/i.test(rpc.error.message)) {
    const { error } = await supabase
      .from("dm2_players")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", playerId);

    if (error && isMissingPlayerProfileColumn(error.message)) {
      return { wrote: false };
    }
    if (error) {
      return { error: error.message, wrote: false };
    }
    return { wrote: true };
  }

  if (isMissingPlayerProfileColumn(rpc.error.message)) {
    return { wrote: false };
  }
  return { error: rpc.error.message, wrote: false };
}

export async function getDm2Players(): Promise<Dm2Player[]> {
  const supabase = await createClient();
  const select = await resolveDm2PlayerSelect();
  const data = await fetchAllSupabasePages<Dm2PlayerRow>("dm2 players", async (from, to) => {
    const result = await supabase
      .from("dm2_players")
      .select(select)
      .order("name", { ascending: true })
      .range(from, to);
    return {
      data: (result.data as unknown as Dm2PlayerRow[] | null) ?? null,
      error: result.error,
    };
  });

  return data.map(mapDm2PlayerRow);
}

export async function resolveDm2SportId(sportLabel: string): Promise<string | null> {
  const trimmed = sportLabel.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pick_list_options")
    .select("id")
    .eq("category", "sport")
    .ilike("label", trimmed)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve sport id:", error.message);
    return null;
  }

  return data?.id ?? null;
}

const comparablePoolCache = new TtlCache<Dm2ComparableCandidate[]>(15 * 60 * 1000);

export async function listDm2ComparableCandidates(input: {
  sportId?: string | null;
  sportLabel?: string | null;
  excludePlayerId?: string | null;
  limit?: number;
}): Promise<Dm2ComparableCandidate[]> {
  const sportId =
    input.sportId?.trim() ||
    (input.sportLabel ? await resolveDm2SportId(input.sportLabel) : null);
  if (!sportId) return [];

  const excludeId = input.excludePlayerId?.trim() || null;
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 50);
  const cached = comparablePoolCache.get(sportId);
  const pool = cached ?? (await loadDm2ComparableSportPool(sportId));
  if (!cached) comparablePoolCache.set(sportId, pool);

  return pool
    .filter((player) => player.id !== excludeId)
    .slice(0, limit);
}

async function loadDm2ComparableSportPool(
  sportId: string
): Promise<Dm2ComparableCandidate[]> {
  const supabase = await createClient();
  const select = await resolveDm2PlayerSelect();
  const withCounts = `${select}, dm2_card_players(count)`;

  const probe = await supabase
    .from("dm2_players")
    .select(withCounts)
    .eq("sport_id", sportId)
    .eq("active", true)
    .range(0, 0);

  const querySelect = probe.error ? select : withCounts;
  const { data, error } = await supabase
    .from("dm2_players")
    .select(querySelect)
    .eq("sport_id", sportId)
    .eq("active", true)
    .order("name", { ascending: true })
    .range(0, 999);

  if (error) {
    console.error("Failed to load dm2 comparable candidates:", error.message);
    return [];
  }

  return ((data as unknown as Dm2PlayerRow[] | null) ?? [])
    .map((row) => {
      const player = mapDm2PlayerRow(row);
      return {
        id: player.id,
        sportId: player.sportId,
        sportName: player.sportName,
        name: player.name,
        imagePath: player.imagePath,
        birthYear: player.birthYear ?? null,
        careerStatus: player.careerStatus ?? null,
        injuryStatus: player.injuryStatus ?? null,
        team: player.team ?? null,
        cardCount: readEmbeddedCount(row.dm2_card_players),
      };
    })
    .sort((left, right) => {
      if (right.cardCount !== left.cardCount) return right.cardCount - left.cardCount;
      return left.name.localeCompare(right.name);
    });
}

export function playerProfileFromDm2(player: {
  birthYear?: number | null;
  careerStatus?: "prospect" | "active" | "retired" | "deceased" | null;
  injuryStatus?: "healthy" | "injured" | null;
  team?: string | null;
}) {
  return {
    birthYear: player.birthYear ?? null,
    careerStatus: player.careerStatus ?? null,
    injuryStatus: player.injuryStatus ?? null,
    team: player.team ?? null,
  };
}

export async function getDm2PlayerCatalogEntries(): Promise<
  Array<{
    id: string;
    sportId: string;
    name: string;
    nameKey: string;
    active: boolean;
  }>
> {
  const supabase = await createClient();
  const data = await fetchAllSupabasePages<{
    id: string;
    sport_id: string;
    name: string;
    name_key: string;
    active: boolean;
  }>("dm2 player catalog", async (from, to) =>
    supabase
      .from("dm2_players")
      .select("id, sport_id, name, name_key, active")
      .order("id", { ascending: true })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    sportId: row.sport_id,
    name: row.name,
    nameKey: row.name_key,
    active: row.active,
  }));
}

export async function getDm2PlayerAliasCatalogEntries(): Promise<
  Array<{
    playerId: string;
    sportId: string;
    name: string;
    nameKey: string;
  }>
> {
  const supabase = await createClient();
  const data = await fetchAllSupabasePages<{
    player_id: string;
    sport_id: string;
    name: string;
    name_key: string;
  }>("dm2 player aliases", async (from, to) =>
    supabase
      .from("dm2_player_aliases")
      .select("player_id, sport_id, name, name_key")
      .order("id", { ascending: true })
      .range(from, to)
  );

  return data.map((row) => ({
    playerId: row.player_id,
    sportId: row.sport_id,
    name: row.name,
    nameKey: row.name_key,
  }));
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

export async function getDm2Attributes(): Promise<Dm2Attribute[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dm2_attributes")
    .select("id, name, active, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load attributes:", error.message);
    return [];
  }

  return (data ?? []).map(mapNameLookupRow);
}

function mapCardAttributeRows(value: unknown): Dm2CardAttributeAssignment[] {
  if (!Array.isArray(value)) return [];

  const assignments = value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as {
        id?: string;
        attribute_id?: string;
        dm2_attributes?: unknown;
      };
      const attribute = Array.isArray(record.dm2_attributes)
        ? record.dm2_attributes[0]
        : record.dm2_attributes;
      const attributeName =
        attribute &&
        typeof attribute === "object" &&
        "name" in attribute &&
        typeof attribute.name === "string"
          ? attribute.name
          : "";
      if (!record.id || !record.attribute_id || !attributeName) return null;
      return {
        id: record.id,
        attributeId: record.attribute_id,
        attributeName,
      };
    })
    .filter((row): row is Dm2CardAttributeAssignment => row != null);

  return assignments.sort((left, right) =>
    left.attributeName.localeCompare(right.attributeName)
  );
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
  psa_heading_id?: number | null;
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
    psaHeadingId: row.psa_heading_id ?? null,
  };
}

const DM2_CARD_SET_BASE_SELECT =
  "id, sport_id, year, brand_id, card_set_category_id, card_set_name_id, active, created_at, pick_list_options(label), dm2_brands(name, dm2_manufacturers(name)), dm2_card_set_categories(name), dm2_card_set_names(name)";
const DM2_CARD_SET_HEADING_SELECT = `${DM2_CARD_SET_BASE_SELECT}, psa_heading_id`;

export async function getDm2CardSets(): Promise<Dm2CardSet[]> {
  const supabase = await createClient();
  const headingProbe = await supabase
    .from("dm2_card_sets")
    .select("psa_heading_id")
    .limit(1);
  const cardSetSelect =
    headingProbe.error && /psa_heading_id|column .* does not exist/i.test(headingProbe.error.message)
      ? DM2_CARD_SET_BASE_SELECT
      : DM2_CARD_SET_HEADING_SELECT;

  const data = await fetchAllSupabasePages<Parameters<typeof mapCardSetRow>[0]>(
    "dm2 card sets",
    async (from, to) =>
      supabase
        .from("dm2_card_sets")
        .select(cardSetSelect as typeof DM2_CARD_SET_BASE_SELECT)
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

function mapCardPlayers(value: unknown): { player: string; playerIds: string[] } {
  const rows = Array.isArray(value) ? value : [];
  const mapped = rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as {
        player_id?: string;
        sort_order?: number;
        dm2_players?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
      };
      const playerRel = Array.isArray(record.dm2_players)
        ? record.dm2_players[0]
        : record.dm2_players;
      const id = playerRel?.id ?? record.player_id;
      const name = typeof playerRel?.name === "string" ? playerRel.name : "";
      if (!id) return null;
      return {
        id,
        name,
        sortOrder: typeof record.sort_order === "number" ? record.sort_order : 0,
      };
    })
    .filter((row): row is { id: string; name: string; sortOrder: number } => row != null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return {
    player: mapped.map((row) => row.name).join("/"),
    playerIds: mapped.map((row) => row.id),
  };
}

function mapCardRow(row: {
  id: string;
  card_set_id: string;
  card_number: string;
  parallel_id: string | null;
  image_path?: string | null;
  active: boolean;
  created_at: string;
  dm2_card_sets: unknown;
  dm2_parallels: unknown;
  dm2_card_attributes?: unknown;
  dm2_card_players?: unknown;
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
  const linkedPlayers = mapCardPlayers(row.dm2_card_players);

  return {
    id: row.id,
    cardSetId: row.card_set_id,
    cardSetLabel,
    cardNumber: row.card_number,
    player: linkedPlayers.player,
    playerIds: linkedPlayers.playerIds,
    parallelId: row.parallel_id,
    parallelName,
    imagePath: row.image_path ?? null,
    attributes: mapCardAttributeRows(row.dm2_card_attributes),
    active: row.active,
    createdAt: row.created_at,
  };
}

export const DM2_SUPABASE_PAGE_SIZE = 1000;

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
    "id, card_set_id, card_number, parallel_id, image_path, active, created_at, dm2_card_sets(year, pick_list_options(label), dm2_brands(name, dm2_manufacturers(name)), dm2_card_set_names(name)), dm2_parallels(name), dm2_card_attributes(id, attribute_id, dm2_attributes(name)), dm2_card_players(player_id, sort_order, dm2_players(id, name))";

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
    "id, card_set_id, card_number, parallel_id, image_path, active, created_at, dm2_card_sets(year, pick_list_options(label), dm2_brands(name, dm2_manufacturers(name)), dm2_card_set_names(name)), dm2_parallels(name), dm2_card_attributes(id, attribute_id, dm2_attributes(name)), dm2_card_players(player_id, sort_order, dm2_players(id, name))";

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

type Dm2CardFormLookupsRpc = {
  manufacturers?: Array<{ id: string; name: string }>;
  brands?: Array<{ id: string; name: string; manufacturer_id: string }>;
  card_set_categories?: Array<{ id: string; name: string }>;
  card_set_names?: Array<{ id: string; name: string }>;
  parallels?: Array<{ id: string; name: string }>;
};

export async function getDm2CardFormLookups(): Promise<Dm2CardFormLookups> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dm2_card_form_lookups");

  if (error) {
    console.error("Failed to load DM2 card form lookups:", error.message);
    return EMPTY_DM2_CARD_FORM_LOOKUPS;
  }

  if (!data || typeof data !== "object") {
    return EMPTY_DM2_CARD_FORM_LOOKUPS;
  }

  const payload = data as Dm2CardFormLookupsRpc;

  return {
    manufacturers: payload.manufacturers ?? [],
    brands: (payload.brands ?? []).map((brand) => ({
      id: brand.id,
      name: brand.name,
      manufacturerId: brand.manufacturer_id,
    })),
    cardSetCategories: payload.card_set_categories ?? [],
    cardSetNames: payload.card_set_names ?? [],
    parallels: payload.parallels ?? [],
  };
}
