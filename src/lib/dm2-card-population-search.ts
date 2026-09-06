import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CARD_POPULATION_SEARCH_STOP_WORDS,
  matchesCardPopulationSearch,
  populationRecordStatus,
} from "@/lib/dm2-card-population";
import type {
  Dm2CardPopulationSearchResult,
  Dm2CardSearchResult,
} from "@/types/data-model-v2";

const MAX_LOOKUP_ROWS = 40;
const MAX_CARD_IDS = 120;
const ID_CHUNK_SIZE = 40;
export const CARD_HYDRATE_SELECT =
  "id, card_set_id, card_number, image_path, dm2_card_sets(year, pick_list_options(label), dm2_brands(name, dm2_manufacturers(name)), dm2_card_set_categories(name), dm2_card_set_names(name)), dm2_parallels(name), dm2_card_players(player_id, sort_order, dm2_players(id, name))";

export function parsePopulationSearchTokens(query: string): {
  tokens: string[];
  years: number[];
  textTokens: string[];
} {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  const years: number[] = [];
  const textTokens: string[] = [];
  for (const token of tokens) {
    if (/^(19|20)\d{2}$/.test(token)) {
      years.push(Number(token));
    } else {
      textTokens.push(token);
    }
  }
  return { tokens, years, textTokens };
}

export function countMatchingNameTokens(name: string, tokens: string[]): number {
  const haystack = name.toLowerCase();
  return tokens.filter((token) => haystack.includes(token)).length;
}

export function selectBestPlayerIds(
  players: Array<{ id: string; name: string }>,
  textTokens: string[]
): string[] {
  if (players.length === 0) return [];
  const scored = players.map((player) => ({
    id: player.id,
    hits: countMatchingNameTokens(player.name, textTokens),
  }));
  const best = Math.max(...scored.map((row) => row.hits), 0);
  if (best === 0) return [];
  return scored.filter((row) => row.hits === best).map((row) => row.id);
}

export function leftoverSearchTokens(
  textTokens: string[],
  playerNames: string[]
): string[] {
  const covered = new Set(
    textTokens.filter((token) =>
      playerNames.some((name) => name.toLowerCase().includes(token))
    )
  );
  return textTokens.filter(
    (token) => !covered.has(token) && !CARD_POPULATION_SEARCH_STOP_WORDS.has(token)
  );
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function chunk<T>(values: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    parts.push(values.slice(index, index + size));
  }
  return parts;
}

function readName(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string; label?: string } | undefined;
    return first?.name ?? first?.label ?? "";
  }
  if (value && typeof value === "object") {
    const record = value as { name?: string; label?: string };
    return record.name ?? record.label ?? "";
  }
  return "";
}

export function mapHydratedCard(
  row: {
    id: string;
    card_set_id: string;
    card_number: string;
    image_path: string | null;
    player?: string | null;
    dm2_card_sets?: unknown;
    dm2_parallels?: unknown;
    dm2_card_players?: unknown;
  },
  fallbackPlayerName = ""
): Dm2CardSearchResult {
  const cardSet = Array.isArray(row.dm2_card_sets)
    ? row.dm2_card_sets[0]
    : row.dm2_card_sets;
  const setRecord =
    cardSet && typeof cardSet === "object"
      ? (cardSet as {
          year?: number;
          pick_list_options?: unknown;
          dm2_brands?: unknown;
          dm2_card_set_categories?: unknown;
          dm2_card_set_names?: unknown;
        })
      : {};
  const brandRel = Array.isArray(setRecord.dm2_brands)
    ? setRecord.dm2_brands[0]
    : setRecord.dm2_brands;
  const brand =
    brandRel && typeof brandRel === "object"
      ? (brandRel as { name?: string; dm2_manufacturers?: unknown })
      : {};
  const players = Array.isArray(row.dm2_card_players) ? row.dm2_card_players : [];
  const playerNames = players
    .map((entry) => {
      const record = entry as {
        sort_order?: number;
        dm2_players?: { name?: string } | { name?: string }[] | null;
      };
      const playerRel = Array.isArray(record.dm2_players)
        ? record.dm2_players[0]
        : record.dm2_players;
      return {
        name: playerRel?.name ?? "",
        sortOrder: typeof record.sort_order === "number" ? record.sort_order : 0,
      };
    })
    .filter((entry) => entry.name)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return {
    id: row.id,
    cardSetId: row.card_set_id,
    sportName: readName(setRecord.pick_list_options),
    year: typeof setRecord.year === "number" ? setRecord.year : 0,
    manufacturerName: readName(brand.dm2_manufacturers),
    brandName: brand.name ?? "",
    cardSetCategoryName: readName(setRecord.dm2_card_set_categories),
    cardSetName: readName(setRecord.dm2_card_set_names),
    cardNumber: row.card_number,
    player:
      playerNames.map((entry) => entry.name).join("/") ||
      (typeof row.player === "string" ? row.player : "") ||
      fallbackPlayerName,
    parallelName: readName(row.dm2_parallels) || null,
    imagePath: row.image_path,
    attributeNames: [],
  };
}

async function lookupIds(
  supabase: SupabaseClient,
  table: string,
  token: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .ilike("name", `%${token}%`)
    .limit(MAX_LOOKUP_ROWS);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

async function selectCardIdsForPlayers(
  supabase: SupabaseClient,
  playerIds: string[],
  cap = 800
): Promise<string[]> {
  const ids: string[] = [];
  for (const playerId of uniqueIds(playerIds)) {
    let from = 0;
    while (ids.length < cap) {
      const { data, error } = await supabase
        .from("dm2_card_players")
        .select("card_id")
        .eq("player_id", playerId)
        .range(from, from + 199);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      for (const row of data) {
        if (typeof row.card_id === "string") ids.push(row.card_id);
      }
      if (data.length < 200) break;
      from += 200;
    }
  }
  return uniqueIds(ids);
}

async function selectSetIdsByOr(
  supabase: SupabaseClient,
  input: {
    years: number[];
    brandIds: string[];
    setNameIds: string[];
    categoryIds: string[];
  }
): Promise<string[]> {
  const results: string[][] = [];
  const base = () =>
    supabase.from("dm2_card_sets").select("id").eq("active", true).limit(MAX_LOOKUP_ROWS);

  if (input.years.length === 1) {
    const { data, error } = await base().eq("year", input.years[0]);
    if (error) throw new Error(error.message);
    results.push((data ?? []).map((row) => row.id));
  } else if (input.years.length > 1) {
    const { data, error } = await base().in("year", input.years);
    if (error) throw new Error(error.message);
    results.push((data ?? []).map((row) => row.id));
  }
  if (input.brandIds.length > 0) {
    const { data, error } = await base().in("brand_id", input.brandIds.slice(0, ID_CHUNK_SIZE));
    if (error) throw new Error(error.message);
    results.push((data ?? []).map((row) => row.id));
  }
  if (input.setNameIds.length > 0) {
    const { data, error } = await base().in(
      "card_set_name_id",
      input.setNameIds.slice(0, ID_CHUNK_SIZE)
    );
    if (error) throw new Error(error.message);
    results.push((data ?? []).map((row) => row.id));
  }
  if (input.categoryIds.length > 0) {
    const { data, error } = await base().in(
      "card_set_category_id",
      input.categoryIds.slice(0, ID_CHUNK_SIZE)
    );
    if (error) throw new Error(error.message);
    results.push((data ?? []).map((row) => row.id));
  }

  return uniqueIds(results.flat());
}

export function cardMatchesLeftoverLookups(
  card: { card_set_id: string; parallel_id: string | null },
  setIds: string[],
  parallelIds: string[]
): boolean {
  if (setIds.length === 0 && parallelIds.length === 0) return true;
  return setIds.includes(card.card_set_id) || parallelIds.includes(card.parallel_id ?? "");
}

export async function searchCardsForPopulation(
  supabase: SupabaseClient,
  query: string,
  options: { page: number; pageSize: number }
): Promise<{ cards: Dm2CardPopulationSearchResult[]; totalCount: number }> {
  const { tokens, years, textTokens } = parsePopulationSearchTokens(query);
  if (tokens.length === 0) {
    return { cards: [], totalCount: 0 };
  }

  let matchedPlayers: Array<{ id: string; name: string }> = [];
  const parallelIds: string[] = [];
  const brandIds: string[] = [];
  const manufacturerIds: string[] = [];
  const setNameIds: string[] = [];
  const categoryIds: string[] = [];

  const playerSearchTokens = textTokens.filter(
    (token) => token.length >= 3 && !CARD_POPULATION_SEARCH_STOP_WORDS.has(token)
  ).slice(0, 2);
  if (playerSearchTokens.length > 0) {
    const playerRows = await Promise.all(
      playerSearchTokens.map((token) =>
        supabase.from("dm2_players").select("id, name").ilike("name", `%${token}%`).limit(MAX_LOOKUP_ROWS)
      )
    );
    const seen = new Set<string>();
    for (const result of playerRows) {
      if (result.error) throw new Error(result.error.message);
      for (const row of result.data ?? []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        matchedPlayers.push({ id: row.id, name: String(row.name ?? "") });
      }
    }
  }

  const playerIds = selectBestPlayerIds(matchedPlayers, textTokens);
  const leftover = leftoverSearchTokens(
    textTokens,
    matchedPlayers.filter((player) => playerIds.includes(player.id)).map((player) => player.name)
  );

  const lookupTokens =
    playerIds.length > 0
      ? leftover
      : textTokens.filter((token) => !CARD_POPULATION_SEARCH_STOP_WORDS.has(token));
  if (lookupTokens.length > 0) {
    const lookups = await Promise.all(
      lookupTokens.slice(0, 3).map((token) =>
        playerIds.length > 0
          ? Promise.all([
              lookupIds(supabase, "dm2_parallels", token),
              Promise.resolve([] as string[]),
              Promise.resolve([] as string[]),
              lookupIds(supabase, "dm2_card_set_names", token),
              lookupIds(supabase, "dm2_card_set_categories", token),
            ])
          : Promise.all([
              lookupIds(supabase, "dm2_parallels", token),
              lookupIds(supabase, "dm2_brands", token),
              lookupIds(supabase, "dm2_manufacturers", token),
              lookupIds(supabase, "dm2_card_set_names", token),
              lookupIds(supabase, "dm2_card_set_categories", token),
            ])
      )
    );
    for (const [parallels, brands, manufacturers, setNames, categories] of lookups) {
      parallelIds.push(...parallels);
      brandIds.push(...brands);
      manufacturerIds.push(...manufacturers);
      setNameIds.push(...setNames);
      categoryIds.push(...categories);
    }
  }

  let brandIdsForSets = uniqueIds(brandIds);
  if (manufacturerIds.length > 0) {
    const { data, error } = await supabase
      .from("dm2_brands")
      .select("id")
      .in("manufacturer_id", uniqueIds(manufacturerIds).slice(0, ID_CHUNK_SIZE))
      .limit(MAX_LOOKUP_ROWS);
    if (error) throw new Error(error.message);
    brandIdsForSets = uniqueIds([...brandIdsForSets, ...(data ?? []).map((row) => row.id)]);
  }

  const setIds = await selectSetIdsByOr(supabase, {
    years,
    brandIds: brandIdsForSets,
    setNameIds: uniqueIds(setNameIds),
    categoryIds: uniqueIds(categoryIds),
  });

  const playerCardIds = playerIds.length > 0 ? await selectCardIdsForPlayers(supabase, playerIds) : [];
  const uniqueParallels = uniqueIds(parallelIds);
  const uniqueSets = uniqueIds(setIds);
  const cardIds = new Set<string>(playerCardIds);
  const fallbackPlayerName = matchedPlayers
    .filter((player) => playerIds.includes(player.id))
    .map((player) => player.name)
    .join("/");

  if (playerCardIds.length === 0 && playerIds.length > 0 && fallbackPlayerName) {
    const { data, error } = await supabase
      .from("dm2_cards")
      .select("id")
      .eq("active", true)
      .ilike("player", `%${fallbackPlayerName}%`)
      .limit(MAX_CARD_IDS);
    if (!error) {
      for (const row of data ?? []) cardIds.add(row.id);
    }
  }

  if (cardIds.size > 0 && (uniqueParallels.length > 0 || uniqueSets.length > 0)) {
    const narrowed = new Set<string>();
    for (const part of chunk([...cardIds], ID_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("dm2_cards")
        .select("id, card_set_id, parallel_id")
        .eq("active", true)
        .in("id", part);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        if (cardMatchesLeftoverLookups(row, uniqueSets, uniqueParallels)) {
          narrowed.add(row.id);
        }
      }
    }
    if (narrowed.size > 0) {
      cardIds.clear();
      for (const id of narrowed) cardIds.add(id);
    }
  } else if (cardIds.size === 0 && (uniqueParallels.length > 0 || uniqueSets.length > 0)) {
    if (uniqueSets.length > 0) {
      const { data, error } = await supabase
        .from("dm2_cards")
        .select("id")
        .eq("active", true)
        .in("card_set_id", uniqueSets.slice(0, ID_CHUNK_SIZE))
        .limit(MAX_CARD_IDS);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) cardIds.add(row.id);
    }
    if (uniqueParallels.length > 0 && cardIds.size < MAX_CARD_IDS) {
      const { data, error } = await supabase
        .from("dm2_cards")
        .select("id")
        .eq("active", true)
        .in("parallel_id", uniqueParallels.slice(0, ID_CHUNK_SIZE))
        .limit(MAX_CARD_IDS - cardIds.size);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) cardIds.add(row.id);
    }
  }

  const ids = [...cardIds].slice(0, MAX_CARD_IDS);
  if (ids.length === 0) {
    return { cards: [], totalCount: 0 };
  }

  const cardRows: Array<Record<string, unknown>> = [];
  for (const part of chunk(ids, ID_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("dm2_cards")
      .select(CARD_HYDRATE_SELECT)
      .eq("active", true)
      .in("id", part);
    if (error) throw new Error(error.message);
    cardRows.push(...((data ?? []) as Array<Record<string, unknown>>));
  }

  const hydrated = cardRows.map((row) =>
    mapHydratedCard(row as Parameters<typeof mapHydratedCard>[0], fallbackPlayerName)
  );
  const strictMatches = hydrated.filter((card) => matchesCardPopulationSearch(card, query));
  const matched = (strictMatches.length > 0 ? strictMatches : hydrated).sort(
      (a, b) =>
        b.year - a.year ||
        a.player.localeCompare(b.player) ||
        a.cardSetName.localeCompare(b.cardSetName) ||
        a.cardNumber.localeCompare(b.cardNumber, undefined, { numeric: true })
    );

  const start = (options.page - 1) * options.pageSize;
  const pageRows = matched.slice(start, start + options.pageSize);
  const pageIds = pageRows.map((card) => card.id);

  const existing = new Set<string>();
  if (pageIds.length > 0) {
    const { data, error } = await supabase
      .from("dm2_card_populations")
      .select("card_id")
      .in("card_id", pageIds);
    if (error && !/does not exist/i.test(error.message)) {
      throw new Error(error.message);
    }
    for (const row of data ?? []) existing.add(row.card_id);
  }

  return {
    cards: pageRows.map((card) => ({
      ...card,
      populationStatus: populationRecordStatus(existing.has(card.id)),
    })),
    totalCount: matched.length,
  };
}
