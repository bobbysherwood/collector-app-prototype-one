import { createClient } from "@/lib/supabase/server";
import {
  CARD_HYDRATE_SELECT,
  mapHydratedCard,
} from "@/lib/dm2-card-population-search";
import { cardNumberVariants } from "@/lib/psa/catalog-match";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

const SET_PAGE = 200;
const CARD_LIMIT = 120;

function chunk<T>(values: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    parts.push(values.slice(index, index + size));
  }
  return parts;
}

export async function findCatalogCardsForPsaCert(input: {
  year: number | null;
  cardNumber: string;
}): Promise<{ error?: string; cards?: Dm2CardSearchResult[] }> {
  if (input.year == null || !input.cardNumber.trim()) {
    return { cards: [] };
  }

  const numbers = cardNumberVariants(input.cardNumber);
  if (numbers.length === 0) return { cards: [] };

  const supabase = await createClient();
  const years = [input.year, input.year - 1, input.year + 1];
  const setIds: string[] = [];

  const { data: sets, error: setError } = await supabase
    .from("dm2_card_sets")
    .select("id")
    .eq("active", true)
    .in("year", years)
    .limit(SET_PAGE);

  if (setError) return { error: setError.message };
  for (const row of sets ?? []) {
    if (typeof row.id === "string") setIds.push(row.id);
  }
  if (setIds.length === 0) return { cards: [] };

  const cards: Dm2CardSearchResult[] = [];
  const seen = new Set<string>();

  for (const setChunk of chunk(setIds, 40)) {
    if (cards.length >= CARD_LIMIT) break;
    const { data, error } = await supabase
      .from("dm2_cards")
      .select(CARD_HYDRATE_SELECT)
      .eq("active", true)
      .in("card_set_id", setChunk)
      .in("card_number", numbers)
      .limit(CARD_LIMIT - cards.length);

    if (error) return { error: error.message };

    for (const row of data ?? []) {
      const card = mapHydratedCard(row as Parameters<typeof mapHydratedCard>[0]);
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      cards.push(card);
    }
  }

  return { cards };
}
