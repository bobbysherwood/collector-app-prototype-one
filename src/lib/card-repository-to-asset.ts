import { CARD_TYPES, SPORTS } from "@/lib/constants";
import type { CardFormData } from "@/types/card";
import type { CardRepositorySearchResult } from "@/types/card-repository";
import type { Sport } from "@/types/card";

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
  "player_name" | "year" | "sport" | "card_type" | "card_number" | "insert_parallel" | "notes"
> {
  const notesParts = [
    card.manufacturer ? `Manufacturer: ${card.manufacturer}` : null,
    card.cardSet ? `Set: ${card.cardSet}` : null,
  ].filter(Boolean);

  return {
    player_name: card.player,
    year: card.year,
    sport: mapRepositoryCategoryToSport(card.category),
    card_type: mapRepositoryBrandToCardType(card.brand),
    card_number: card.cardNumber,
    insert_parallel: card.parallel ?? "",
    notes: notesParts.join("\n"),
  };
}
