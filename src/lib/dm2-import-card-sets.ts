import {
  applyCatalogCardSetHintsToRows,
  buildCatalogCardSetProfiles,
  getUniqueSetNameCategories,
} from "@/lib/dm2-import-catalog-hints";
import {
  bulkUpdateDm2Rows,
  getDm2LookupFieldOptions,
  getLookupBlockingIssueCount,
  getPendingProposalCount,
  reprocessImportReviewSession,
  type Dm2EditableRowFields,
  type Dm2ImportReviewStepCommitResult,
  type Dm2LookupRowField,
} from "@/lib/dm2-import-resolve";
import type {
  Dm2ExtractedRow,
  Dm2ImportCatalogContext,
  Dm2ImportSession,
} from "@/types/dm2-import";

export const CARD_SET_GROUP_FIELDS = [
  "sport",
  "year",
  "manufacturer",
  "brand",
  "cardSetCategory",
  "cardSetName",
] as const;

export type CardSetGroupField = (typeof CARD_SET_GROUP_FIELDS)[number];

export type CardSetReviewAction = "pending" | "confirmed";

export interface Dm2CardSetGroup {
  id: string;
  sport?: string;
  year?: number;
  manufacturer?: string;
  brand?: string;
  cardSetCategory?: string;
  cardSetName?: string;
  referenceCount: number;
  rowIds: string[];
  missingFields: CardSetGroupField[];
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function cardSetGroupKeyFromRow(row: Dm2ExtractedRow): string {
  return [
    normalizeKey(row.sport ?? ""),
    String(row.year ?? ""),
    normalizeKey(row.manufacturer ?? ""),
    normalizeKey(row.brand ?? ""),
    normalizeKey(row.cardSetCategory ?? ""),
    normalizeKey(row.cardSetName ?? ""),
  ].join("|");
}

export function getCardSetMissingFields(
  group: Pick<Dm2CardSetGroup, CardSetGroupField>
): CardSetGroupField[] {
  const missing: CardSetGroupField[] = [];
  if (!group.sport?.trim()) missing.push("sport");
  if (group.year == null) missing.push("year");
  if (!group.manufacturer?.trim()) missing.push("manufacturer");
  if (!group.brand?.trim()) missing.push("brand");
  if (!group.cardSetCategory?.trim()) missing.push("cardSetCategory");
  if (!group.cardSetName?.trim()) missing.push("cardSetName");
  return missing;
}

export function buildCardSetGroups(rows: Dm2ExtractedRow[]): Dm2CardSetGroup[] {
  const groups = new Map<string, Dm2CardSetGroup>();

  for (const row of rows) {
    if (row.excluded) continue;

    const id = cardSetGroupKeyFromRow(row);
    const existing = groups.get(id);
    if (existing) {
      existing.referenceCount += 1;
      existing.rowIds.push(row.id);
      continue;
    }

    const group: Dm2CardSetGroup = {
      id,
      sport: row.sport,
      year: row.year,
      manufacturer: row.manufacturer,
      brand: row.brand,
      cardSetCategory: row.cardSetCategory,
      cardSetName: row.cardSetName,
      referenceCount: 1,
      rowIds: [row.id],
      missingFields: [],
    };
    group.missingFields = getCardSetMissingFields(group);
    groups.set(id, group);
  }

  return [...groups.values()].sort((a, b) =>
    formatCardSetGroupLabel(a).localeCompare(formatCardSetGroupLabel(b))
  );
}

export function formatCardSetGroupLabel(
  group: Pick<
    Dm2CardSetGroup,
    "year" | "brand" | "cardSetCategory" | "cardSetName" | "sport" | "manufacturer"
  >
): string {
  const parts = [
    group.year?.toString(),
    group.brand,
    group.cardSetCategory,
    group.cardSetName,
  ].filter(Boolean);

  if (parts.length === 0) {
    return group.sport || group.manufacturer || "Incomplete card set";
  }

  return parts.join(" · ");
}

export function formatCardSetRowLabel(row: Dm2ExtractedRow): string {
  return formatCardSetGroupLabel({
    sport: row.sport,
    year: row.year,
    brand: row.brand,
    cardSetCategory: row.cardSetCategory,
    cardSetName: row.cardSetName,
  });
}

export function cardSetFieldLabel(field: CardSetGroupField): string {
  switch (field) {
    case "sport":
      return "Sport";
    case "year":
      return "Year";
    case "manufacturer":
      return "Manufacturer";
    case "brand":
      return "Brand";
    case "cardSetCategory":
      return "Category";
    case "cardSetName":
      return "Set Name";
  }
}

export function findCardSetCatalogMatch(
  session: Dm2ImportSession,
  group: Dm2CardSetGroup
): { matched: boolean; detail: string } {
  const catalog = session.catalog;
  if (!catalog) {
    return { matched: false, detail: "—" };
  }

  if (group.missingFields.includes("cardSetCategory") && group.cardSetName?.trim()) {
    const profiles = buildCatalogCardSetProfiles(catalog);
    const uniqueByName = getUniqueSetNameCategories(profiles);
    const sampleRow = session.rows.find((row) => group.rowIds.includes(row.id));
    if (sampleRow) {
      const hinted = applyCatalogCardSetHintsToRows([sampleRow], catalog)[0];
      if (hinted.cardSetCategory && hinted.cardSetCategory !== sampleRow.cardSetCategory) {
        return {
          matched: false,
          detail: `Catalog suggests category: ${hinted.cardSetCategory}`,
        };
      }
    }
    const globalCategory = uniqueByName.get(normalizeKey(group.cardSetName));
    if (globalCategory) {
      return {
        matched: false,
        detail: `Catalog suggests category: ${globalCategory}`,
      };
    }
  }

  if (group.missingFields.length > 0) {
    return { matched: false, detail: "—" };
  }

  const sport = catalog.sports.find(
    (item) => normalizeKey(item.label) === normalizeKey(group.sport ?? "")
  );
  const brand = catalog.brands.find(
    (item) =>
      normalizeKey(item.name) === normalizeKey(group.brand ?? "") &&
      normalizeKey(item.manufacturerName) === normalizeKey(group.manufacturer ?? "")
  );
  const category = catalog.cardSetCategories.find(
    (item) => normalizeKey(item.name) === normalizeKey(group.cardSetCategory ?? "")
  );
  const setName = catalog.cardSetNames.find(
    (item) => normalizeKey(item.name) === normalizeKey(group.cardSetName ?? "")
  );

  if (!sport || !brand || !category || !setName || group.year == null) {
    return { matched: false, detail: "New combination" };
  }

  const existing = catalog.cardSets.find(
    (item) =>
      item.sportId === sport.id &&
      item.year === group.year &&
      item.brandId === brand.id &&
      item.cardSetCategoryId === category.id &&
      item.cardSetNameId === setName.id
  );

  if (existing) {
    return { matched: true, detail: "Existing card set" };
  }

  return { matched: false, detail: "New card set" };
}

export function updateCardSetGroupField(
  session: Dm2ImportSession,
  group: Dm2CardSetGroup,
  field: CardSetGroupField,
  value: string
): Dm2ImportSession {
  const rowIdSet = new Set(group.rowIds);
  const updates: Partial<Dm2EditableRowFields> = { [field]: value };

  return bulkUpdateDm2Rows(session, (row) => rowIdSet.has(row.id), updates, {
    skipRebuild: true,
  });
}

export function getCardSetFieldOptions(
  session: Dm2ImportSession,
  field: CardSetGroupField,
  group: Dm2CardSetGroup
): string[] {
  if (field === "year") {
    const years = new Set<string>();
    if (session.sessionContext.year != null) {
      years.add(String(session.sessionContext.year));
    }
    for (const row of session.rows) {
      if (row.year != null) years.add(String(row.year));
    }
    return [...years].sort();
  }

  if (field === "sport" || field === "manufacturer" || field === "brand" || field === "cardSetCategory" || field === "cardSetName") {
    const sampleRow = session.rows.find((row) => group.rowIds.includes(row.id));
    return getDm2LookupFieldOptions(session, field as Dm2LookupRowField, sampleRow);
  }

  return [];
}

export function isCardSetGroupReady(group: Dm2CardSetGroup): boolean {
  return group.missingFields.length === 0;
}

export function countPendingCardSetGroups(
  groups: Dm2CardSetGroup[],
  actions: Record<string, CardSetReviewAction>
): number {
  return groups.filter((group) => {
    if (!isCardSetGroupReady(group)) return true;
    return (actions[group.id] ?? "pending") !== "confirmed";
  }).length;
}

export function autoConfirmReadyCardSetGroups(
  groups: Dm2CardSetGroup[],
  actions: Record<string, CardSetReviewAction>
): Record<string, CardSetReviewAction> {
  const next = { ...actions };
  for (const group of groups) {
    if (isCardSetGroupReady(group)) {
      next[group.id] = "confirmed";
    }
  }
  return next;
}

/** Commit step 2: finalize card set mappings and reprocess rows for card review. */
export function commitCardSetsReviewStep(
  session: Dm2ImportSession,
  groups: Dm2CardSetGroup[],
  actions: Record<string, CardSetReviewAction>
): Dm2ImportReviewStepCommitResult {
  const lookupsReady =
    Boolean(session.reviewProgress?.lookupsCommittedAt) ||
    (getPendingProposalCount(session) === 0 &&
      getLookupBlockingIssueCount(session) === 0);

  if (!lookupsReady) {
    return {
      error: "Commit the lookup review step before committing card sets.",
    };
  }

  const lookupsCommittedAt =
    session.reviewProgress?.lookupsCommittedAt ?? new Date().toISOString();

  const pending = countPendingCardSetGroups(groups, actions);
  if (pending > 0) {
    return {
      error: `${pending} card set(s) still need confirmation or have missing required fields.`,
    };
  }

  const reprocessed = reprocessImportReviewSession(session);

  return {
    session: {
      ...reprocessed,
      reviewProgress: {
        lookupsCommittedAt,
        cardSetsCommittedAt: new Date().toISOString(),
      },
    },
  };
}
