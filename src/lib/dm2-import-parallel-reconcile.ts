import type { Dm2ExtractedRow, Dm2ImportCatalogContext } from "@/types/dm2-import";

type CardSetValueSplit = {
  cardSetName: string;
  parallel: string | null;
  cardSetCategory: string | null;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function buildCatalogParallelKeyMap(
  catalogParallels: string[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of catalogParallels) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    map.set(normalizeKey(trimmed), trimmed);
  }
  return map;
}

export function isKnownCatalogParallelName(
  name: string,
  catalogParallels: string[]
): boolean {
  return buildCatalogParallelKeyMap(catalogParallels).has(normalizeKey(name));
}

/** Split "Base …" combined CARD SET values using catalog subsets and parallels. */
export function splitBasePrefixedCardSetValue(
  rawValue: string,
  catalogParallels: string[],
  catalogCardSetNames: string[]
): CardSetValueSplit | null {
  const trimmed = rawValue.trim();
  if (!trimmed.toLowerCase().startsWith("base ")) return null;

  const afterBase = trimmed.slice(5).trim();
  if (!afterBase) return null;

  const subsetCandidates = catalogCardSetNames
    .map((name) => name.trim())
    .filter((name) => {
      const key = normalizeKey(name);
      return key && key !== "base set" && key !== "base";
    })
    .sort((a, b) => b.length - a.length);

  for (const subset of subsetCandidates) {
    const subsetKey = subset.toLowerCase();
    const afterKey = afterBase.toLowerCase();
    if (afterKey === subsetKey || afterKey.startsWith(`${subsetKey} `)) {
      const remainder = afterBase.slice(subset.length).trim();
      return {
        cardSetName: subset,
        parallel: remainder || null,
        cardSetCategory: "Subset",
      };
    }
  }

  const sortedParallels = [...catalogParallels]
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const parallel of sortedParallels) {
    const parallelKey = parallel.toLowerCase();
    const afterKey = afterBase.toLowerCase();
    if (afterKey === parallelKey || afterKey.startsWith(`${parallelKey} `)) {
      const remainder = afterBase.slice(parallel.length).trim();
      const fullParallel = remainder ? `${parallel} ${remainder}` : parallel;
      return {
        cardSetName: "Base Set",
        parallel: fullParallel,
        cardSetCategory: "Base Set",
      };
    }
  }

  return null;
}

export function applyBasePrefixedCatalogSplits(
  enriched: Record<string, CardSetValueSplit>,
  distinctValues: string[],
  catalogParallels: string[],
  catalogCardSetNames: string[]
): void {
  if (catalogParallels.length === 0) return;

  for (const rawValue of distinctValues) {
    const split = splitBasePrefixedCardSetValue(
      rawValue,
      catalogParallels,
      catalogCardSetNames
    );
    if (split) {
      enriched[rawValue] = split;
    }
  }
}

function resolveCompoundParallel(
  primary: string,
  secondary: string | undefined,
  parallelByKey: Map<string, string>
): string {
  if (!secondary?.trim()) return primary;
  const compound = `${primary} ${secondary}`.trim();
  return parallelByKey.get(normalizeKey(compound)) ?? compound;
}

/** Move known catalog parallel names out of cardSetName on extracted rows. */
export function reconcileExtractedRowsWithCatalogParallels(
  rows: Dm2ExtractedRow[],
  catalog: Dm2ImportCatalogContext
): Dm2ExtractedRow[] {
  const parallelByKey = new Map(
    catalog.parallels.map((parallel) => [normalizeKey(parallel.name), parallel.name])
  );
  const setNameKeys = new Set(
    catalog.cardSetNames.map((setName) => normalizeKey(setName.name))
  );

  if (parallelByKey.size === 0) return rows;

  return rows.map((row) => {
    if (row.excluded || !row.cardSetName?.trim()) return row;

    const setKey = normalizeKey(row.cardSetName);
    if (setNameKeys.has(setKey)) return row;

    const parallelName = parallelByKey.get(setKey);
    if (!parallelName) return row;

    const nextParallel = resolveCompoundParallel(
      parallelName,
      row.parallel,
      parallelByKey
    );

    return {
      ...row,
      cardSetName: "Base Set",
      parallel: nextParallel,
      cardSetCategory: "Base Set",
    };
  });
}
