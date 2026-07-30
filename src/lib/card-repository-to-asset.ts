import { CARD_TYPES, SPORTS } from "@/lib/constants";
import type { CardFormData, Sport } from "@/types/card";
import type { CardRepositorySearchResult } from "@/types/card-repository";

export function mapRepositoryCategoryToSport(category: string): Sport {
  const normalized = category.trim();
  if ((SPORTS as readonly string[]).includes(normalized)) {
    return normalized as Sport;
  }
  return "Other";
}

export function mapRepositoryBrandToCardType(brand: string): string {
  const normalized = brand.trim();
  if ((CARD_TYPES as readonly string[]).includes(normalized)) {
    return normalized;
  }
  return normalized || "Other";
}

export function formatRepositoryCardLabel(card: CardRepositorySearchResult): string {
  const parts = [
    String(card.year),
    card.manufacturer,
    card.brand,
    card.cardSet,
    card.cardNumber ? `#${card.cardNumber}` : null,
    card.player,
    card.parallel ? `(${card.parallel})` : null,
  ].filter(Boolean);

  return parts.join(" ");
}

export function repositoryCardToFormPrefill(
  card: CardRepositorySearchResult
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
    sport: mapRepositoryCategoryToSport(card.category),
    manufacturer: card.manufacturer,
    brand: mapRepositoryBrandToCardType(card.brand),
    card_set_category: card.cardSetCategory,
    card_set_name: card.cardSet,
    card_number: card.cardNumber,
    insert_parallel: card.parallel ?? "",
    notes: "",
  };
}
