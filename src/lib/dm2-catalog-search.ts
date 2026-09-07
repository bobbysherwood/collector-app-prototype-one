import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CARD_HYDRATE_SELECT,
  mapHydratedCard,
  parsePopulationSearchTokens,
  searchCardsForPopulation,
} from "@/lib/dm2-card-population-search";
import { cardSearchTokens, playerNameContainsAllTokens } from "@/lib/dm2-card-search";
import type {
  Dm2CardSearchResult,
  Dm2PlayerSearchResult,
} from "@/types/data-model-v2";

const PLAYER_LOOKUP_LIMIT = 80;
const ID_CHUNK_SIZE = 40;

function chunk<T>(values: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    parts.push(values.slice(index, index + size));
  }
  return parts;
}

async function hydrateCardsById(
  supabase: SupabaseClient,
  cardIds: string[],
  fallbackPlayerName = ""
): Promise<Dm2CardSearchResult[]> {
  const ids = [...new Set(cardIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const rows: Dm2CardSearchResult[] = [];
  for (const part of chunk(ids, ID_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("dm2_cards")
      .select(CARD_HYDRATE_SELECT)
      .eq("active", true)
      .in("id", part);
    if (error) throw new Error(error.message);
    rows.push(
      ...((data ?? []) as Array<Parameters<typeof mapHydratedCard>[0]>).map((row) =>
        mapHydratedCard(row, fallbackPlayerName)
      )
    );
  }
  return rows;
}

export async function searchPlayersByName(
  supabase: SupabaseClient,
  query: string
): Promise<Dm2PlayerSearchResult[]> {
  const tokens = cardSearchTokens(query);
  const firstToken = tokens[0];
  if (!firstToken) return [];

  const { data, error } = await supabase
    .from("dm2_players")
    .select("id, name, sport_id, image_path")
    .eq("active", true)
    .ilike("name", `%${firstToken}%`)
    .limit(PLAYER_LOOKUP_LIMIT);
  if (error) throw new Error(error.message);

  const aliasMatches: Array<{ player_id: string }> = [];
  const { data: aliases, error: aliasError } = await supabase
    .from("dm2_player_aliases")
    .select("player_id")
    .ilike("name", `%${firstToken}%`)
    .limit(PLAYER_LOOKUP_LIMIT);
  if (!aliasError) {
    aliasMatches.push(...(aliases ?? []));
  }

  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      sport_id: string;
      image_path: string | null;
    }
  >();
  for (const row of data ?? []) {
    byId.set(row.id, {
      id: row.id,
      name: String(row.name ?? ""),
      sport_id: String(row.sport_id ?? ""),
      image_path: row.image_path ?? null,
    });
  }

  const missingAliasIds = aliasMatches
    .map((row) => row.player_id)
    .filter((id) => id && !byId.has(id));
  if (missingAliasIds.length > 0) {
    const { data: extra, error: extraError } = await supabase
      .from("dm2_players")
      .select("id, name, sport_id, image_path")
      .eq("active", true)
      .in("id", missingAliasIds.slice(0, PLAYER_LOOKUP_LIMIT));
    if (!extraError) {
      for (const row of extra ?? []) {
        byId.set(row.id, {
          id: row.id,
          name: String(row.name ?? ""),
          sport_id: String(row.sport_id ?? ""),
          image_path: row.image_path ?? null,
        });
      }
    }
  }

  const matched = [...byId.values()]
    .filter((row) => playerNameContainsAllTokens(row.name, tokens))
    .sort((a, b) => {
      const aExact = a.name.trim().toLowerCase() === query.trim().toLowerCase() ? 0 : 1;
      const bExact = b.name.trim().toLowerCase() === query.trim().toLowerCase() ? 0 : 1;
      return aExact - bExact || a.name.localeCompare(b.name);
    })
    .slice(0, 50);

  const sportIds = [...new Set(matched.map((row) => row.sport_id).filter(Boolean))];
  const sportLabels = new Map<string, string>();
  if (sportIds.length > 0) {
    const { data: sports, error: sportError } = await supabase
      .from("pick_list_options")
      .select("id, label")
      .in("id", sportIds);
    if (sportError) throw new Error(sportError.message);
    for (const sport of sports ?? []) {
      sportLabels.set(sport.id, String(sport.label ?? ""));
    }
  }

  return matched.map((row) => ({
    id: row.id,
    player: row.name,
    sport: sportLabels.get(row.sport_id) ?? "",
    sportId: row.sport_id,
    imagePath: row.image_path,
    cardCount: 0,
  }));
}

export async function listHydratedCardsForPlayer(
  supabase: SupabaseClient,
  playerId: string,
  options: { page: number; pageSize: number }
): Promise<{ cards: Dm2CardSearchResult[]; totalCount: number }> {
  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize - 1;

  const { data: links, error } = await supabase
    .from("dm2_card_players")
    .select("card_id")
    .eq("player_id", playerId)
    .range(from, to);
  if (error) throw new Error(error.message);

  const cardIds = (links ?? [])
    .map((row) => row.card_id)
    .filter((id): id is string => typeof id === "string");
  const cards = await hydrateCardsById(supabase, cardIds);
  const totalCount =
    from + cards.length + (cards.length === options.pageSize ? options.pageSize : 0);

  return { cards, totalCount };
}

export async function listHydratedCardsForSport(
  supabase: SupabaseClient,
  sportId: string,
  options: { page: number; pageSize: number }
): Promise<{ cards: Dm2CardSearchResult[]; totalCount: number }> {
  const { data: sets, error: setError } = await supabase
    .from("dm2_card_sets")
    .select("id")
    .eq("sport_id", sportId)
    .eq("active", true)
    .limit(80);
  if (setError) throw new Error(setError.message);

  const setIds = (sets ?? []).map((row) => row.id).filter(Boolean);
  if (setIds.length === 0) {
    return { cards: [], totalCount: 0 };
  }

  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize - 1;
  const { data, error } = await supabase
    .from("dm2_cards")
    .select(CARD_HYDRATE_SELECT)
    .eq("active", true)
    .in("card_set_id", setIds)
    .range(from, to);
  if (error) throw new Error(error.message);

  const cards = ((data ?? []) as Array<Parameters<typeof mapHydratedCard>[0]>).map((row) =>
    mapHydratedCard(row)
  );
  return {
    cards,
    totalCount:
      from + cards.length + (cards.length === options.pageSize ? options.pageSize : 0),
  };
}

export async function searchHydratedCards(
  supabase: SupabaseClient,
  query: string,
  options: { page: number; pageSize: number }
): Promise<{ cards: Dm2CardSearchResult[]; totalCount: number }> {
  const { tokens } = parsePopulationSearchTokens(query);
  if (tokens.length === 0) {
    return { cards: [], totalCount: 0 };
  }

  const result = await searchCardsForPopulation(supabase, query, options);
  return {
    cards: result.cards.map(({ populationStatus: _status, ...card }) => card),
    totalCount: result.totalCount,
  };
}
