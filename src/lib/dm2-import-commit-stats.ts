import { createId } from "@/lib/create-id";
import type {
  Dm2ImportCommitAddedStats,
  Dm2ImportCommitDuplicateEntityType,
  Dm2ImportCommitDuplicateItem,
  Dm2ImportCommitErrorCode,
  Dm2ImportCommitErrorItem,
  Dm2ImportCommitResult,
} from "@/types/dm2-import";

export const COMMIT_DETAIL_LIMIT = 200;

const REMEDIES: Record<Dm2ImportCommitErrorCode, string> = {
  pre_commit_validation:
    "Complete all three review steps (lookups, card sets, cards) and commit each step before saving to the database.",
  lookup_create_failed:
    "Check Admin → Data Model v2 for an existing entry with the same name, or edit the lookup proposal in Validate lookups and try again.",
  brand_without_manufacturer:
    "In Validate lookups, set the manufacturer to Create new or Use existing before committing the brand.",
  card_set_create_failed:
    "Verify sport, year, brand, category, and set name in Validate card set, then commit that step again.",
  row_incomplete:
    "Return to Validate cards, fill in the missing fields for the listed rows, commit the cards step, and run Review commit again. Duplicates are skipped on retry.",
  card_set_unresolved:
    "Confirm the card set combination in Validate card set and commit that step before importing cards.",
  batch_insert_failed:
    "Retry the import. If the error persists, check server logs and database constraints.",
  unexpected_shortfall:
    "Some rows did not save. Review the error list, fix issues in the review steps, and commit again.",
};

export function commitErrorRemedy(code: Dm2ImportCommitErrorCode): string {
  return REMEDIES[code];
}

export interface CommitStatsCollector {
  added: Dm2ImportCommitAddedStats;
  duplicates: Dm2ImportCommitDuplicateItem[];
  errors: Dm2ImportCommitErrorItem[];
  cardsFailed: number;
  cardsSkipped: number;
  incrementCardsFailed: () => void;
  incrementCardsSkipped: () => void;
  pushDuplicate: (item: Omit<Dm2ImportCommitDuplicateItem, "id">) => void;
  pushError: (item: Omit<Dm2ImportCommitErrorItem, "id" | "remedy">) => void;
  toResult: (
    overrides?: Partial<Dm2ImportCommitResult>
  ) => Dm2ImportCommitResult;
}

export function createCommitStatsCollector(): CommitStatsCollector {
  const added: Dm2ImportCommitAddedStats = {
    sports: 0,
    manufacturers: 0,
    brands: 0,
    cardSetCategories: 0,
    cardSetNames: 0,
    parallels: 0,
    cardSets: 0,
    cards: 0,
  };
  const duplicates: Dm2ImportCommitDuplicateItem[] = [];
  const errors: Dm2ImportCommitErrorItem[] = [];
  let cardsFailed = 0;
  let cardsSkipped = 0;

  function pushDuplicate(item: Omit<Dm2ImportCommitDuplicateItem, "id">) {
    if (duplicates.length < COMMIT_DETAIL_LIMIT) {
      duplicates.push({ id: createId(), ...item });
    }
  }

  function pushError(item: Omit<Dm2ImportCommitErrorItem, "id" | "remedy">) {
    if (errors.length < COMMIT_DETAIL_LIMIT) {
      errors.push({
        id: createId(),
        remedy: commitErrorRemedy(item.code),
        ...item,
      });
    }
  }

  function toResult(
    overrides: Partial<Dm2ImportCommitResult> = {}
  ): Dm2ImportCommitResult {
    return {
      sportsCreated: added.sports,
      manufacturersCreated: added.manufacturers,
      brandsCreated: added.brands,
      cardSetCategoriesCreated: added.cardSetCategories,
      cardSetNamesCreated: added.cardSetNames,
      parallelsCreated: added.parallels,
      cardSetsCreated: added.cardSets,
      cardsCreated: added.cards,
      cardsSkipped,
      cardsFailed,
      added,
      duplicates,
      errors,
      ...overrides,
    };
  }

  return {
    added,
    duplicates,
    errors,
    get cardsFailed() {
      return cardsFailed;
    },
    get cardsSkipped() {
      return cardsSkipped;
    },
    incrementCardsFailed() {
      cardsFailed += 1;
    },
    incrementCardsSkipped() {
      cardsSkipped += 1;
    },
    pushDuplicate,
    pushError,
    toResult,
  };
}

export function duplicateEntityLabel(
  entityType: Dm2ImportCommitDuplicateEntityType,
  name: string
): string {
  switch (entityType) {
    case "sport":
      return `Sport: ${name}`;
    case "manufacturer":
      return `Manufacturer: ${name}`;
    case "brand":
      return `Brand: ${name}`;
    case "cardSetCategory":
      return `Category: ${name}`;
    case "cardSetName":
      return `Set name: ${name}`;
    case "parallel":
      return `Parallel: ${name}`;
    case "cardSet":
      return `Card set: ${name}`;
    case "card":
      return name;
    default:
      return name;
  }
}

export function hasFixableRowErrors(result: Dm2ImportCommitResult): boolean {
  return (
    result.errors?.some(
      (item) =>
        item.code === "row_incomplete" ||
        item.code === "card_set_unresolved" ||
        item.code === "card_set_create_failed"
    ) ?? false
  );
}

export function totalAdded(result: Dm2ImportCommitResult): number {
  const added = result.added;
  if (!added) return result.cardsCreated ?? 0;
  return (
    added.sports +
    added.manufacturers +
    added.brands +
    added.cardSetCategories +
    added.cardSetNames +
    added.parallels +
    added.cardSets +
    added.cards
  );
}
