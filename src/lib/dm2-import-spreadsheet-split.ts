const BASE_SET_ROOTS = new Set(["base", "base set"]);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeBrandProgramName(value: string): string {
  return value.replace(/\s*\(\d{2}-\d{2}\)\s*$/i, "").trim();
}

export function findCardSetRoots(distinctValues: string[]): string[] {
  const values = [
    ...new Set(distinctValues.map((value) => value.trim()).filter(Boolean)),
  ];
  return values.filter(
    (value) =>
      !values.some(
        (other) => other !== value && value.startsWith(`${other} `)
      )
  );
}

export function normalizeCardSetRootName(root: string): string {
  const trimmed = root.trim();
  const key = normalizeKey(trimmed);
  if (key === "base") return "Base Set";
  if (key.startsWith("base ")) {
    return trimmed.replace(/^base\s+/i, "").trim();
  }
  return trimmed;
}

export function inferCardSetCategory(
  cardSetName: string,
  rawValue?: string
): string {
  const key = normalizeKey(cardSetName);
  if (BASE_SET_ROOTS.has(key)) return "Base Set";

  const rawKey = rawValue ? normalizeKey(rawValue) : "";
  if (rawKey.startsWith("base ") && !BASE_SET_ROOTS.has(key)) {
    return "Subset";
  }

  return "Insert";
}

function buildParallelSuffixIndex(
  distinctValues: string[]
): Map<string, Set<string>> {
  const values = [
    ...new Set(distinctValues.map((value) => value.trim()).filter(Boolean)),
  ];
  const suffixIndex = new Map<string, Set<string>>();

  for (const value of values) {
    for (const root of values) {
      if (!value.startsWith(`${root} `)) continue;
      const suffix = value.slice(root.length + 1).trim();
      if (!suffix) continue;
      if (!suffixIndex.has(root)) suffixIndex.set(root, new Set());
      suffixIndex.get(root)!.add(suffix);
    }
  }

  return suffixIndex;
}

function pickExtensionRoot(
  trimmed: string,
  candidates: string[],
  suffixIndex: Map<string, Set<string>>
): string | undefined {
  const extensionRoots = candidates
    .filter((root) => {
      const candidate = root.trim();
      if (!trimmed.startsWith(`${candidate} `)) return false;
      if (
        normalizeKey(candidate) === "base" &&
        trimmed.split(/\s+/).length > 2
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.trim().length - b.trim().length);

  const matches = extensionRoots
    .map((root) => ({
      root: root.trim(),
      parallel: trimmed.slice(root.trim().length + 1).trim(),
    }))
    .filter(
      (match) =>
        match.parallel && suffixIndex.get(match.root)?.has(match.parallel)
    )
    .sort((a, b) => b.parallel.length - a.parallel.length);

  return (
    matches[0]?.root ??
    extensionRoots.sort((a, b) => b.trim().length - a.trim().length)[0]
  );
}

export function splitCombinedCardSetValue(
  value: string,
  candidateRoots: string[],
  suffixIndex?: Map<string, Set<string>>
): { cardSetName: string; parallel?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { cardSetName: "" };

  const candidates = [
    ...new Set(candidateRoots.map((entry) => entry.trim()).filter(Boolean)),
  ];
  const parallelIndex = suffixIndex ?? buildParallelSuffixIndex(candidates);

  const extensionRoot = pickExtensionRoot(trimmed, candidates, parallelIndex);
  if (extensionRoot) {
    const parallel = trimmed.slice(extensionRoot.length + 1).trim();
    return {
      cardSetName: normalizeCardSetRootName(extensionRoot),
      parallel: parallel || undefined,
    };
  }

  if (candidates.includes(trimmed)) {
    return { cardSetName: normalizeCardSetRootName(trimmed) };
  }

  return { cardSetName: normalizeCardSetRootName(trimmed) };
}

export function buildCardSetSplitIndex(
  distinctValues: string[]
): Map<
  string,
  { cardSetName: string; parallel?: string; cardSetCategory: string }
> {
  const values = [
    ...new Set(distinctValues.map((value) => value.trim()).filter(Boolean)),
  ];
  const suffixIndex = buildParallelSuffixIndex(values);
  const index = new Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >();

  for (const value of values) {
    const split = splitCombinedCardSetValue(value, values, suffixIndex);
    index.set(value, {
      ...split,
      cardSetCategory: inferCardSetCategory(split.cardSetName, value),
    });
  }

  return index;
}

const PANINI_PRODUCT_PATTERN =
  /donruss|prizm|select|optic|mosaic|contenders|national treasures|flawless|immaculate/i;

const TOPPS_PRODUCT_PATTERN = /topps|bowman|chrome|finest|stadium club|heritage/i;

const UPPER_DECK_PRODUCT_PATTERN = /upper deck|sp authentic|young guns/i;

export function resolveManufacturerFromBrand(input: {
  brand?: string;
  catalogBrands?: Array<{
    name: string;
    manufacturerName: string;
  }>;
}): string | undefined {
  const brand = normalizeBrandProgramName(input.brand ?? "");
  if (!brand) return undefined;

  const brandKey = normalizeKey(brand);
  const catalogMatch = input.catalogBrands?.find(
    (entry) => normalizeKey(entry.name) === brandKey
  );
  if (catalogMatch) return catalogMatch.manufacturerName;

  const fuzzyCatalogMatch = input.catalogBrands?.find((entry) => {
    const entryKey = normalizeKey(entry.name);
    return entryKey.includes(brandKey) || brandKey.includes(entryKey);
  });
  if (fuzzyCatalogMatch) return fuzzyCatalogMatch.manufacturerName;

  if (PANINI_PRODUCT_PATTERN.test(brand)) return "Panini";
  if (TOPPS_PRODUCT_PATTERN.test(brand)) return "Topps";
  if (UPPER_DECK_PRODUCT_PATTERN.test(brand)) return "Upper Deck";

  return undefined;
}
