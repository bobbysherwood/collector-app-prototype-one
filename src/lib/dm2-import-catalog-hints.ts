import type {
  Dm2ExtractedRow,
  Dm2ImportCatalogContext,
  Dm2ImportSession,
} from "@/types/dm2-import";

export interface Dm2CatalogCardSetProfile {
  cardSetName: string;
  cardSetCategory: string;
  sportLabel: string;
  year: number;
  brandName: string;
  manufacturerName: string;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function buildCatalogCardSetProfiles(
  catalog: Dm2ImportCatalogContext
): Dm2CatalogCardSetProfile[] {
  if (!catalog.cardSetProfiles?.length) return [];

  return catalog.cardSetProfiles.filter(
    (profile) => profile.cardSetName.trim() && profile.cardSetCategory.trim()
  );
}

/** Set names that exist in catalog as Insert checklists. */
export function getCatalogInsertSetNames(
  profiles: Dm2CatalogCardSetProfile[]
): string[] {
  const names = new Set<string>();
  for (const profile of profiles) {
    if (normalizeKey(profile.cardSetCategory) === "insert") {
      names.add(profile.cardSetName.trim());
    }
  }
  return [...names];
}

/** Globally unique set name → category (when name maps to exactly one category). */
export function getUniqueSetNameCategories(
  profiles: Dm2CatalogCardSetProfile[]
): Map<string, string> {
  const byName = new Map<string, Set<string>>();

  for (const profile of profiles) {
    const key = normalizeKey(profile.cardSetName);
    const categories = byName.get(key) ?? new Set<string>();
    categories.add(profile.cardSetCategory.trim());
    byName.set(key, categories);
  }

  const unique = new Map<string, string>();
  for (const [nameKey, categories] of byName) {
    if (categories.size === 1) {
      unique.set(nameKey, [...categories][0]);
    }
  }
  return unique;
}

function rowMatchesProfile(
  row: Dm2ExtractedRow,
  profile: Dm2CatalogCardSetProfile
): boolean {
  if (row.year != null && row.year !== profile.year) return false;
  if (row.sport && normalizeKey(row.sport) !== normalizeKey(profile.sportLabel)) {
    return false;
  }
  if (row.brand && normalizeKey(row.brand) !== normalizeKey(profile.brandName)) {
    return false;
  }
  if (
    row.manufacturer &&
    normalizeKey(row.manufacturer) !== normalizeKey(profile.manufacturerName)
  ) {
    return false;
  }
  return true;
}

function inferCategoryForRow(
  row: Dm2ExtractedRow,
  profilesByName: Map<string, Dm2CatalogCardSetProfile[]>,
  uniqueByName: Map<string, string>
): string | undefined {
  if (!row.cardSetName?.trim()) return undefined;

  const nameKey = normalizeKey(row.cardSetName);
  const matchingProfiles = (profilesByName.get(nameKey) ?? []).filter((profile) =>
    rowMatchesProfile(row, profile)
  );

  if (matchingProfiles.length === 1) {
    return matchingProfiles[0].cardSetCategory;
  }

  if (matchingProfiles.length > 1) {
    const categories = new Set(
      matchingProfiles.map((profile) => profile.cardSetCategory.trim())
    );
    if (categories.size === 1) {
      return [...categories][0];
    }
  }

  return uniqueByName.get(nameKey);
}

/** Apply known catalog card set category/name pairings to import rows. */
export function applyCatalogCardSetHintsToRows(
  rows: Dm2ExtractedRow[],
  catalog?: Dm2ImportCatalogContext
): Dm2ExtractedRow[] {
  if (!catalog) return rows;

  const profiles = buildCatalogCardSetProfiles(catalog);
  if (profiles.length === 0) return rows;

  const uniqueByName = getUniqueSetNameCategories(profiles);
  const profilesByName = new Map<string, Dm2CatalogCardSetProfile[]>();
  for (const profile of profiles) {
    const key = normalizeKey(profile.cardSetName);
    const list = profilesByName.get(key) ?? [];
    list.push(profile);
    profilesByName.set(key, list);
  }

  return rows.map((row) => {
    if (row.excluded || !row.cardSetName?.trim()) return row;

    const inferred = inferCategoryForRow(row, profilesByName, uniqueByName);
    if (!inferred) return row;

    const current = row.cardSetCategory?.trim();
    if (current && normalizeKey(current) === normalizeKey(inferred)) {
      return row;
    }

    return { ...row, cardSetCategory: inferred };
  });
}

export function applyCatalogCardSetHintsToSession(
  session: Dm2ImportSession
): Dm2ImportSession {
  return {
    ...session,
    rows: applyCatalogCardSetHintsToRows(session.rows, session.catalog),
  };
}

/** Format catalog insert examples for AI split enrichment. */
export function formatCatalogInsertExamples(
  profiles: Dm2CatalogCardSetProfile[],
  limit = 40
): string[] {
  return profiles
    .filter((profile) => normalizeKey(profile.cardSetCategory) === "insert")
    .map((profile) => profile.cardSetName.trim())
    .filter(Boolean)
    .filter((name, index, all) => all.indexOf(name) === index)
    .slice(0, limit);
}
