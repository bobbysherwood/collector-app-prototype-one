import {
  mapRepositoryBrandToCardType,
  mapRepositoryCategoryToSport,
} from "@/lib/card-repository-to-asset";
import type { Asset, CardFormData } from "@/types/card";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

const RESEARCH_ASSET_ID_PREFIX = "dm2:";

export function formatDm2CardLabel(card: Dm2CardSearchResult): string {
  const parts = [
    String(card.year),
    card.sportName,
    `${card.manufacturerName} | ${card.brandName}`,
    card.cardSetName,
    card.cardNumber ? `#${card.cardNumber}` : null,
    card.player,
    card.parallelName ? `(${card.parallelName})` : null,
  ].filter(Boolean);

  return parts.join(" ");
}

/** Synthetic asset for market research / eBay search (not persisted). */
export function dm2CardToSyntheticAsset(card: Dm2CardSearchResult): Asset {
  const timestamp = new Date(0).toISOString();

  return {
    id: `${RESEARCH_ASSET_ID_PREFIX}${card.id}`,
    user_id: "research",
    player_name: card.player,
    year: card.year,
    card_type: mapRepositoryBrandToCardType(card.brandName),
    sport: mapRepositoryCategoryToSport(card.sportName),
    card_number: card.cardNumber || null,
    card_set_name: card.cardSetName || null,
    insert_parallel: card.parallelName,
    image_path: card.imagePath,
    notes: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function dm2CardToFormPrefill(
  card: Dm2CardSearchResult
): Pick<
  CardFormData,
  | "player_name"
  | "year"
  | "sport"
  | "manufacturer"
  | "brand"
  | "card_set_category"
  | "card_set_name"
  | "card_number"
  | "insert_parallel"
  | "notes"
> {
  return {
    player_name: card.player,
    year: card.year,
    sport: mapRepositoryCategoryToSport(card.sportName),
    manufacturer: card.manufacturerName,
    brand: card.brandName,
    card_set_category: card.cardSetCategoryName,
    card_set_name: card.cardSetName,
    card_number: card.cardNumber,
    insert_parallel: card.parallelName ?? "",
    notes: "",
  };
}
