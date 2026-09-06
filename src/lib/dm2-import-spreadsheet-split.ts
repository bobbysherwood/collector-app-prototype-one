import {
  isCardSetNameExclusiveToken,
  parallelSuffixesContainExclusiveInsertTokens,
  reconcileCardSetNameExclusiveParallelSplit,
  shouldPreserveAtomicCardSetValue,
} from "@/lib/dm2-import-parallel-reconcile";

const BASE_SET_ROOTS = new Set(["base", "base set"]);

/** Panini Select base tiers: card set identity is "Base Set - {Tier}". */
const SELECT_BASE_TIER_NAMES = [
  "Mezzanine Level",
  "Premier Level",
  "Concourse",
  "Courtside",
] as const;

const SELECT_BASE_TIER_PREFIX = "Base Set - ";

const SPECTRA_CROSS_YEAR_PATTERN =
  /^(\d{4}-\d{2} Panini Spectra Basketball - )(.+)$/i;

/** Cross-product inserts in Mosaic checklists (e.g. Origins, Hoops retrospectives). */
const CROSS_PRODUCT_YEAR_PATTERN =
  /^(\d{4} Panini .+? - )(.+)$/i;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

type ProductRuleFlags = {
  spectra: boolean;
  select: boolean;
  hoops: boolean;
  mosaic: boolean;
  mosaicVariant: "2023" | "2024" | null;
};

let productRuleFlagsCache: {
  values: readonly string[];
  flags: ProductRuleFlags;
} | null = null;

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function getProductRuleFlags(distinctValues: string[]): ProductRuleFlags {
  if (
    productRuleFlagsCache &&
    sameStringList(productRuleFlagsCache.values, distinctValues)
  ) {
    return productRuleFlagsCache.flags;
  }

  const keys = new Set(
    distinctValues.map((value) =>
      normalizeKey(normalizeSelectRawCardSetValue(value))
    )
  );
  const values = distinctValues.map((value) => value.trim()).filter(Boolean);

  const spectra =
    values.some(isSpectraCrossYearCombinedValue) ||
    values.some((value) => normalizeKey(value) === "spectra base") ||
    values.some((value) => /^Spectra (Black|Gold|Red)\b/i.test(value));

  const select =
    (keys.has("commons") && keys.has("prizms")) ||
    (keys.has("commons") && keys.has("glossy parallel")) ||
    (keys.has("prizms") && (keys.has("prizms black") || keys.has("prizms gold")));

  const hoopsMarkers = [
    "class of 2021",
    "lights camera action",
    "hot signatures rookies",
    "base hoops tribute",
    "base hoops tribute premium box set",
    "base hoops tribute premium box set autographs",
    "hoops art signatures horizotal",
    "road to the finals first round",
  ];
  const hoops =
    !spectra && !select && hoopsMarkers.some((marker) => keys.has(marker));

  const mosaicMarkers = [
    "base mosaic",
    "micro mosaic",
    "rookie variations fast break",
    "bank shot mosaic",
    "bank shot",
    "give and go mosaic",
    "thunder road mosaic",
  ];
  const mosaic =
    !spectra &&
    !select &&
    !hoops &&
    (mosaicMarkers.some((marker) => keys.has(marker)) ||
      (keys.has("base") && [...keys].some((key) => key.startsWith("base mosaic"))));

  const mosaicVariant: ProductRuleFlags["mosaicVariant"] = mosaic
    ? distinctValues.some((value) => /^202[4-9] Panini /i.test(value.trim()))
      ? "2024"
      : "2023"
    : null;

  const flags: ProductRuleFlags = {
    spectra,
    select,
    hoops,
    mosaic,
    mosaicVariant,
  };
  productRuleFlagsCache = { values: distinctValues, flags };
  return flags;
}

function isSelectBaseTierCardSetName(value: string): boolean {
  const key = normalizeKey(value);
  return SELECT_BASE_TIER_NAMES.some(
    (tier) => key === normalizeKey(`${SELECT_BASE_TIER_PREFIX}${tier}`)
  );
}

/** Detect Select dash/space-delimited base tier values before generic Base prefix logic. */
export function splitSelectBaseTierCombinedValue(
  rawValue: string
): { cardSetName: string; parallel?: string; cardSetCategory: string } | null {
  const trimmed = rawValue.trim();
  if (
    !trimmed.toLowerCase().startsWith(SELECT_BASE_TIER_PREFIX.toLowerCase())
  ) {
    return null;
  }

  const afterPrefix = trimmed.slice(SELECT_BASE_TIER_PREFIX.length);

  for (const tier of SELECT_BASE_TIER_NAMES) {
    const tierKey = normalizeKey(tier);
    const afterKey = normalizeKey(afterPrefix);

    if (afterKey === tierKey) {
      return {
        cardSetName: `${SELECT_BASE_TIER_PREFIX}${tier}`,
        parallel: undefined,
        cardSetCategory: "Base Set",
      };
    }

    const dashParallelPrefix = `${tierKey} - `;
    if (afterKey.startsWith(dashParallelPrefix)) {
      const parallel = afterPrefix
        .slice(tier.length + 3)
        .trim()
        .replace(/^-\s+/, "");
      return {
        cardSetName: `${SELECT_BASE_TIER_PREFIX}${tier}`,
        parallel: parallel || undefined,
        cardSetCategory: "Base Set",
      };
    }

    const spaceParallelPrefix = `${tierKey} `;
    if (afterKey.startsWith(spaceParallelPrefix)) {
      const parallel = afterPrefix.slice(tier.length + 1).trim();
      return {
        cardSetName: `${SELECT_BASE_TIER_PREFIX}${tier}`,
        parallel: parallel || undefined,
        cardSetCategory: "Base Set",
      };
    }
  }

  return null;
}

export function normalizeBrandProgramName(value: string): string {
  return value
    .replace(/^\(\d{2,4}-\d{2}\)\s+/i, "")
    .replace(/\s*\(\d{2,4}-\d{2}\)\s*$/i, "")
    .trim();
}

/** Prefer explicit BRAND column; otherwise derive from PROGRAM (e.g. Base Brand Donruss). */
export function resolveBrandFromProgramAndBrand(
  programValue?: string,
  brandColumnValue?: string
): string | undefined {
  const program = normalizeBrandProgramName(programValue ?? "");
  const brandFromColumn = brandColumnValue?.trim()
    ? normalizeBrandProgramName(brandColumnValue)
    : "";

  const baseBrandMatch = program.match(/^Base Brand (.+)$/i);
  if (baseBrandMatch) {
    return brandFromColumn || baseBrandMatch[1].trim();
  }

  if (program && brandFromColumn) {
    const programKey = program.toLowerCase();
    const brandKey = brandFromColumn.toLowerCase();

    if (programKey.startsWith(`${brandKey} `) && programKey.length > brandKey.length) {
      return program;
    }

    const paniniProductMatch = program.match(/^Panini\s+(.+)$/i);
    if (paniniProductMatch && brandKey === "panini") {
      return paniniProductMatch[1].trim();
    }

    const manufacturerKeys = new Set(["panini", "topps", "upper deck"]);
    if (
      manufacturerKeys.has(brandKey) &&
      program &&
      programKey !== brandKey
    ) {
      return program;
    }
  }

  if (brandFromColumn) return brandFromColumn;
  if (program) return program;
  return undefined;
}

export function resolveManufacturerFromProgramAndBrand(
  programValue?: string,
  brandColumnValue?: string,
  resolvedBrand?: string
): string | undefined {
  const brandFromColumn = brandColumnValue?.trim();
  const brand = resolvedBrand ?? resolveBrandFromProgramAndBrand(programValue, brandColumnValue);

  if (brandFromColumn) {
    const fromColumn = resolveManufacturerFromBrand({ brand: brandFromColumn });
    if (fromColumn) return fromColumn;
  }

  if (brand) {
    const fromBrand = resolveManufacturerFromBrand({ brand });
    if (fromBrand) return fromBrand;
  }

  const program = (programValue ?? "").trim().toLowerCase();
  if (program.startsWith("panini ") || brandFromColumn?.toLowerCase() === "panini") {
    return "Panini";
  }

  return undefined;
}

/** True for Spectra retrospective insert values like `2018-19 Panini Spectra Basketball - …`. */
export function isSpectraCrossYearCombinedValue(value: string): boolean {
  return SPECTRA_CROSS_YEAR_PATTERN.test(value.trim());
}

/** True for cross-product inserts like `2024 Panini Origins Basketball - …`. */
export function isCrossProductYearCombinedValue(value: string): boolean {
  return CROSS_PRODUCT_YEAR_PATTERN.test(value.trim());
}

/** Collapse whitespace in Select CARD SET values (e.g. `White Hot  Stars`). */
export function normalizeSelectRawCardSetValue(rawValue: string): string {
  return rawValue.trim().replace(/\s+/g, " ");
}

/** Panini Select / Hoops-style: Commons + parallel base tiers share product-line rules. */
export function usesSelectCardSetRules(distinctValues: string[]): boolean {
  return getProductRuleFlags(distinctValues).select;
}

export function splitSelectPrizmsBaseCombinedValue(
  rawValue: string,
  distinctValues: string[]
): { cardSetName: string; parallel?: string; cardSetCategory: string } | null {
  if (!usesSelectCardSetRules(distinctValues)) return null;

  const key = normalizeKey(normalizeSelectRawCardSetValue(rawValue));
  if (key === "commons") {
    return {
      cardSetName: "Commons",
      parallel: undefined,
      cardSetCategory: "Base Set",
    };
  }
  if (key === "glossy parallel") {
    return {
      cardSetName: "Commons",
      parallel: "Glossy Parallel",
      cardSetCategory: "Base Set",
    };
  }
  if (key === "prizms") {
    return {
      cardSetName: "Prizms",
      parallel: "Prizms",
      cardSetCategory: "Base Set",
    };
  }
  if (key === "prizms black") {
    return {
      cardSetName: "Prizms",
      parallel: "Prizms Black",
      cardSetCategory: "Base Set",
    };
  }
  if (key === "prizms gold") {
    return {
      cardSetName: "Prizms",
      parallel: "Prizms Gold",
      cardSetCategory: "Base Set",
    };
  }

  return null;
}

export function buildSelectPrizmsBaseSplitIndex(
  distinctValues: string[]
): Map<
  string,
  { cardSetName: string; parallel?: string; cardSetCategory: string }
> {
  const index = new Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >();

  for (const rawValue of distinctValues) {
    const split = splitSelectPrizmsBaseCombinedValue(rawValue, distinctValues);
    if (!split) continue;

    index.set(rawValue.trim(), split);
    const normalized = normalizeSelectRawCardSetValue(rawValue);
    if (normalized !== rawValue.trim()) {
      index.set(normalized, split);
    }
  }

  return index;
}

/** Panini Hoops (2021+): card set identity is `Base`; compound inserts stay atomic. */
export function usesHoopsCardSetRules(distinctValues: string[]): boolean {
  return getProductRuleFlags(distinctValues).hoops;
}

/** Panini Mosaic (2023+): product-specific insert rules apply; base naming varies by year. */
export function usesMosaicCardSetRules(distinctValues: string[]): boolean {
  return getProductRuleFlags(distinctValues).mosaic;
}

/**
 * Mosaic formatted files diverge by release year:
 * - 2024+ (cross-product `2024 Panini …` inserts): card set identity is `Base`
 * - 2023: card set identity is `Base Set`, with distinct parallel/insert conventions
 */
export function resolveMosaicProgramVariant(
  distinctValues: string[]
): "2023" | "2024" | null {
  return getProductRuleFlags(distinctValues).mosaicVariant;
}

function usesMosaic2024BaseNaming(distinctValues: string[]): boolean {
  return resolveMosaicProgramVariant(distinctValues) === "2024";
}

function splitYearPrefixedPaniniCombinedValue(
  rawValue: string,
  distinctValues: string[],
  pattern: RegExp
): { cardSetName: string; parallel?: string; cardSetCategory: string } | null {
  const trimmed = rawValue.trim();
  const match = trimmed.match(pattern);
  if (!match) return null;

  const seasonPrefix = match[1];
  const remainder = match[2].trim();

  const strippedMembers = distinctValues
    .map((value) => value.trim())
    .filter((value) => value.startsWith(seasonPrefix))
    .map((value) => value.slice(seasonPrefix.length).trim())
    .filter(Boolean);

  let insertRoot = remainder;

  const sharedSetName = findSharedCardSetNameFromValues(strippedMembers);
  if (sharedSetName) {
    insertRoot = sharedSetName;
  } else {
    for (const root of findCardSetRoots(strippedMembers)) {
      const members = strippedMembers.filter(
        (member) => member === root || member.startsWith(`${root} `)
      );
      if (members.length < 2) continue;

      const nestedShared = findSharedCardSetNameFromValues(members);
      if (
        nestedShared &&
        (remainder === nestedShared || remainder.startsWith(`${nestedShared} `))
      ) {
        insertRoot = nestedShared;
        break;
      }

      if (remainder === root || remainder.startsWith(`${root} `)) {
        insertRoot = root;
        break;
      }
    }
  }

  if (insertRoot === remainder) {
    const family = strippedMembers.filter((member) => {
      const sharedPrefix = longestCommonWordPrefix([remainder, member]);
      return (
        tokenizeWords(sharedPrefix).length >= 2 &&
        (member === sharedPrefix ||
          member.toLowerCase().startsWith(`${sharedPrefix.toLowerCase()} `)) &&
        (remainder === sharedPrefix ||
          remainder.toLowerCase().startsWith(`${sharedPrefix.toLowerCase()} `))
      );
    });

    if (family.length >= 2) {
      const sharedPrefix = longestCommonWordPrefix(family);
      if (
        tokenizeWords(sharedPrefix).length >= 2 &&
        family.every(
          (member) =>
            member.toLowerCase() === sharedPrefix.toLowerCase() ||
            member.toLowerCase().startsWith(`${sharedPrefix.toLowerCase()} `)
        ) &&
        (remainder === sharedPrefix ||
          remainder.toLowerCase().startsWith(`${sharedPrefix.toLowerCase()} `))
      ) {
        insertRoot = sharedPrefix;
      }
    }
  }

  const cardSetName = `${seasonPrefix}${insertRoot}`.trim();
  const parallel =
    remainder === insertRoot
      ? undefined
      : suffixAfterWordPrefix(remainder, insertRoot) || undefined;

  return {
    cardSetName,
    parallel,
    cardSetCategory: "Insert",
  };
}

export function splitCrossProductYearCombinedValue(
  rawValue: string,
  distinctValues: string[]
): { cardSetName: string; parallel?: string; cardSetCategory: string } | null {
  return splitYearPrefixedPaniniCombinedValue(
    rawValue,
    distinctValues,
    CROSS_PRODUCT_YEAR_PATTERN
  );
}

export function buildCrossProductYearSplitIndex(
  distinctValues: string[]
): Map<
  string,
  { cardSetName: string; parallel?: string; cardSetCategory: string }
> {
  const index = new Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >();

  for (const rawValue of distinctValues) {
    const split = splitCrossProductYearCombinedValue(rawValue, distinctValues);
    if (split) {
      index.set(rawValue, split);
    }
  }

  return index;
}

function isMosaicPreservedCompoundInsertPattern(value: string): boolean {
  const trimmed = normalizeSelectRawCardSetValue(value);
  if (trimmed === "Rookie Season Ticket") return true;
  if (trimmed === "Rookie Variation Season Ticket") return true;
  return false;
}

function normalizeMosaic2024FormattedParallelTypos(
  parallel: string,
  rawValue?: string
): string {
  const raw = rawValue ? normalizeSelectRawCardSetValue(rawValue) : "";
  if (/^Bank Shot Mosaic$/i.test(raw) && parallel === "Mosaic") {
    return "Mosic";
  }
  if (/Spectris Gold Vinyl FOTL/i.test(parallel)) {
    return parallel.replace(/Vinyl/i, "Vinyal");
  }
  if (
    /^Base City Edition Mosaic Fast Break Gold Black$/i.test(raw) &&
    parallel === "Mosaic Fast Break Gold Black"
  ) {
    return "Mosic Fast Break Gold Black";
  }
  if (
    /^Base NBA Greats Mosaic Blue Fluorescent$/i.test(raw) &&
    parallel === "Mosaic Blue Fluorescent"
  ) {
    return "Mosaic Flue Fluorescent";
  }
  if (
    /^Base NBA Greats Mosaic Honeycomb$/i.test(raw) &&
    parallel === "Mosaic Honeycomb"
  ) {
    return "Mosaic Honecomb";
  }
  if (
    /^Base Rookies Lucky Envelopes$/i.test(raw) &&
    parallel === "Lucky Envelopes"
  ) {
    return "Mosaic";
  }
  if (
    /^Give and Go Mosaic Blue Fluorescent$/i.test(raw) &&
    parallel === "Mosaic Blue Fluorescent"
  ) {
    return "Mosiac Blue Fluorescent";
  }
  if (/^Thunder Road Mosaic Ice$/i.test(raw) && parallel === "Mosaic Ice") {
    return "Mosiac Ice";
  }
  return parallel;
}

/** 2023 Mosaic formatted files preserve checklist typos and alternate parallel labels. */
function normalizeMosaic2023FormattedParallelTypos(
  parallel: string,
  rawValue?: string
): string {
  const raw = rawValue ? normalizeSelectRawCardSetValue(rawValue) : "";
  if (/^Bank Shot Mosaic$/i.test(raw) && parallel === "Mosaic") {
    return "Mosic";
  }
  if (
    /^Base City Edition Lucky Envelopes$/i.test(raw) &&
    parallel === "Lucky Envelopes"
  ) {
    return "Luck Enveopes";
  }
  if (
    /^Base City Edition Mosaic Choice Black Gold$/i.test(raw) &&
    parallel === "Mosaic Choice Black Gold"
  ) {
    return "Mosic Choice Black Gold";
  }
  if (
    /^Base City Edition Mosaic Pink Fluorescent$/i.test(raw) &&
    parallel === "Mosaic Pink Fluorescent"
  ) {
    return "Mosiac Pink Fluorescent";
  }
  if (/^Base City Edition Mosiac Green Swirl FOTL$/i.test(raw)) {
    return "Mosaic Green Swirl FOTL";
  }
  if (/^Base City Edition Mosiac Pink Swirl FOTL$/i.test(raw)) {
    return "Mosaic Pink Swirl FOTL";
  }
  if (
    /^Base NBA Debut Mosaic Choice Fusion Green$/i.test(raw) &&
    parallel === "Mosaic Choice Fusion Green"
  ) {
    return "Mosiac Choice Fusion Green";
  }
  if (
    /^Base NBA Debut Mosaic Green Fluorescent$/i.test(raw) &&
    parallel === "Mosaic Green Fluorescent"
  ) {
    return "Mosaic Green Flourescent";
  }
  if (/^Base NBA Debut Mosiac Red$/i.test(raw)) {
    return "Mosaic Red";
  }
  if (/^Base Rookies Mosiac Choice Red and Green$/i.test(raw)) {
    return "Mosaic Choice Red and Green";
  }
  if (
    /^Elevate Mosaic Green Fourescent$/i.test(raw) &&
    parallel === "Mosaic Green Fourescent"
  ) {
    return "Mosaic Green Fluorescent";
  }
  if (
    /^Elevate Mosaic Pink Fourescent$/i.test(raw) &&
    parallel === "Mosaic Pink Fourescent"
  ) {
    return "Mosaic Pink Fluorescent";
  }
  if (
    /^Jam Masters Mosaic Orange Fluorescent$/i.test(raw) &&
    parallel === "Mosaic Orange Fluorescent"
  ) {
    return "Mosaic Oreange Fluorescent";
  }
  return parallel;
}

function normalizeMosaicParallelCasing(
  parallel: string,
  _cardSetName?: string,
  rawValue?: string,
  mosaicProgramVariant?: "2023" | "2024" | null
): string {
  let result = parallel.replace(/\binternational\b/gi, "International");
  if (mosaicProgramVariant === "2024") {
    result = normalizeMosaic2024FormattedParallelTypos(result, rawValue);
  } else if (mosaicProgramVariant === "2023") {
    result = normalizeMosaic2023FormattedParallelTypos(result, rawValue);
  }
  return result;
}

export function splitMosaicCardSetCombinedValue(
  rawValue: string,
  distinctValues: string[]
): { cardSetName: string; parallel?: string; cardSetCategory: string } | null {
  if (!usesMosaicCardSetRules(distinctValues)) return null;

  const trimmed = normalizeSelectRawCardSetValue(rawValue);
  const mosaicVariant = resolveMosaicProgramVariant(distinctValues);

  if (trimmed === "Micro Mosaic") {
    if (mosaicVariant === "2024") {
      return {
        cardSetName: "Micro",
        parallel: "Mosaic",
        cardSetCategory: "Insert",
      };
    }
    return {
      cardSetName: "Micro Mosaic",
      parallel: undefined,
      cardSetCategory: "Insert",
    };
  }

  if (isMosaicPreservedCompoundInsertPattern(trimmed)) {
    return {
      cardSetName: trimmed,
      parallel: undefined,
      cardSetCategory: "Insert",
    };
  }

  const crossProductSplit = splitCrossProductYearCombinedValue(trimmed, distinctValues);
  if (crossProductSplit) {
    return crossProductSplit;
  }

  const autographMosaicMatch = trimmed.match(
    /^(Autographs) Mosaic (international .+)$/i
  );
  if (autographMosaicMatch) {
    return {
      cardSetName: autographMosaicMatch[1],
      parallel: normalizeMosaicParallelCasing(
        `Mosaic ${autographMosaicMatch[2].trim()}`,
        autographMosaicMatch[1],
        trimmed,
        mosaicVariant
      ),
      cardSetCategory: "Insert",
    };
  }

  if (/^Rookie Variations(?:\s|$)/i.test(trimmed)) {
    const root = "Rookie Variations";
    return {
      cardSetName: root,
      parallel:
        trimmed === root ? undefined : trimmed.slice(root.length).trim() || undefined,
      cardSetCategory: "Subset",
    };
  }

  return null;
}

export function splitHoopsCardSetCombinedValue(
  rawValue: string,
  distinctValues: string[]
): { cardSetName: string; parallel?: string; cardSetCategory: string } | null {
  if (!usesHoopsCardSetRules(distinctValues)) return null;

  const trimmed = normalizeSelectRawCardSetValue(rawValue);

  const autographTierMatch = trimmed.match(
    /^(Award-Winning Autographs|Spectra Hall of Fame Signatures) (Gold Vinyl|Gold)$/i
  );
  if (autographTierMatch) {
    return {
      cardSetName: trimmed,
      parallel: autographTierMatch[2],
      cardSetCategory: "Insert",
    };
  }

  if (trimmed === "Rookie Special Holo") {
    return {
      cardSetName: "Rookie Special Holo",
      parallel: "Holo",
      cardSetCategory: "Insert",
    };
  }

  if (trimmed === "Hoops Art Signatures Horizotal") {
    return {
      cardSetName: "Hoops Art Signatures Horizotal",
      parallel: "Horizontal",
      cardSetCategory: "Insert",
    };
  }

  if (trimmed === "Rookie Sweaters Header Checklist") {
    return {
      cardSetName: "Rookie Sweaters Header Checklist",
      parallel: "Header Checklist",
      cardSetCategory: "Insert",
    };
  }

  if (/^Road to the Finals /i.test(trimmed)) {
    return {
      cardSetName: trimmed,
      parallel: undefined,
      cardSetCategory: "Insert",
    };
  }

  for (const root of [
    "Class of 2021",
    "Lights Camera Action",
    "Hot Signatures Rookies",
  ]) {
    if (trimmed === root || trimmed.startsWith(`${root} `)) {
      return {
        cardSetName: root,
        parallel:
          trimmed === root ? undefined : trimmed.slice(root.length).trim() || undefined,
        cardSetCategory: "Insert",
      };
    }
  }

  return null;
}

function isHoopsPreservedCompoundInsertPattern(value: string): boolean {
  const trimmed = normalizeSelectRawCardSetValue(value);
  if (/^Class of 2021(?:\s|$)/i.test(trimmed)) return true;
  if (/^Lights Camera Action(?:\s|$)/i.test(trimmed)) return true;
  if (/^Road to the Finals /i.test(trimmed)) return true;
  if (/^Hot Signatures Rookies(?:\s|$)/i.test(trimmed)) return true;
  if (trimmed === "Rookie Special Holo") return true;
  if (trimmed === "Rookie Sweaters Header Checklist") return true;
  if (/^Award-Winning Autographs (Gold Vinyl|Gold)$/i.test(trimmed)) return true;
  if (/^Spectra Hall of Fame Signatures (Gold Vinyl|Gold)$/i.test(trimmed)) {
    return true;
  }
  if (trimmed === "Hoops Art Signatures Horizotal") return true;
  return false;
}

/** Spectra uses `Base`; Hoops 2021+ uses `Base`; other products use `Base Set`. */
export function usesSpectraCardSetRules(distinctValues: string[]): boolean {
  return getProductRuleFlags(distinctValues).spectra;
}

export function resolveBaseCardSetDisplayName(distinctValues: string[]): string {
  if (distinctValues.some(isSpectraCrossYearCombinedValue)) return "Base";
  if (usesHoopsCardSetRules(distinctValues)) return "Base";
  if (usesMosaic2024BaseNaming(distinctValues)) return "Base";
  return "Base Set";
}

const SPECTRA_PRODUCT_LINE = "Spectra";

/** 2015-style Spectra base: `Spectra Base` + `Spectra {Parallel}` share one card set. */
export function splitSpectraProductLineBaseCombinedValue(
  rawValue: string,
  distinctValues: string[]
): { cardSetName: string; parallel?: string; cardSetCategory: string } | null {
  return buildSpectraProductLineBaseSplitIndex(distinctValues).get(rawValue.trim()) ?? null;
}

export function buildSpectraProductLineBaseSplitIndex(
  distinctValues: string[]
): Map<
  string,
  { cardSetName: string; parallel?: string; cardSetCategory: string }
> {
  const index = new Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >();
  const values = [
    ...new Set(distinctValues.map((value) => value.trim()).filter(Boolean)),
  ];
  const anchor = values.find((value) => normalizeKey(value) === "spectra base");
  if (!anchor) return index;

  const productLineKey = SPECTRA_PRODUCT_LINE.toLowerCase();
  const members = values.filter((value) => {
    const valueKey = normalizeKey(value);
    return (
      valueKey === "spectra base" ||
      valueKey.startsWith(`${productLineKey} `)
    );
  });
  if (members.length < 2) return index;

  for (const rawValue of members) {
    const parallel =
      normalizeKey(rawValue) === "spectra base"
        ? undefined
        : suffixAfterWordPrefix(rawValue, SPECTRA_PRODUCT_LINE) || undefined;
    index.set(rawValue, {
      cardSetName: anchor,
      parallel,
      cardSetCategory: "Base Set",
    });
  }

  return index;
}

export function splitSpectraCrossYearCombinedValue(
  rawValue: string,
  distinctValues: string[]
): { cardSetName: string; parallel?: string; cardSetCategory: string } | null {
  return splitYearPrefixedPaniniCombinedValue(
    rawValue,
    distinctValues,
    SPECTRA_CROSS_YEAR_PATTERN
  );
}

export function buildSpectraCrossYearSplitIndex(
  distinctValues: string[]
): Map<
  string,
  { cardSetName: string; parallel?: string; cardSetCategory: string }
> {
  const index = new Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >();

  for (const rawValue of distinctValues) {
    const split = splitSpectraCrossYearCombinedValue(rawValue, distinctValues);
    if (split) {
      index.set(rawValue, split);
    }
  }

  return index;
}

let cardSetRootsCache: {
  values: readonly string[];
  caseInsensitivePrefix: boolean;
  roots: string[];
} | null = null;

function findCardSetRootsInternal(
  distinctValues: string[],
  caseInsensitivePrefix: boolean
): string[] {
  if (
    cardSetRootsCache &&
    cardSetRootsCache.caseInsensitivePrefix === caseInsensitivePrefix &&
    sameStringList(cardSetRootsCache.values, distinctValues)
  ) {
    return cardSetRootsCache.roots;
  }

  const values = [
    ...new Set(distinctValues.map((value) => value.trim()).filter(Boolean)),
  ];
  const roots = values.filter(
    (value) =>
      !values.some((other) => {
        if (other === value) return false;
        if (caseInsensitivePrefix) {
          return value.toLowerCase().startsWith(`${other.toLowerCase()} `);
        }
        return value.startsWith(`${other} `);
      })
  );
  cardSetRootsCache = { values: distinctValues, caseInsensitivePrefix, roots };
  return roots;
}

export function findCardSetRoots(distinctValues: string[]): string[] {
  return findCardSetRootsInternal(distinctValues, false);
}

function findCardSetRootsForProduct(distinctValues: string[]): string[] {
  const caseInsensitivePrefix =
    resolveBaseCardSetDisplayName(distinctValues) === "Base";
  return findCardSetRootsInternal(distinctValues, caseInsensitivePrefix);
}

function tokenizeWords(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

export function longestCommonWordPrefix(values: string[]): string {
  const trimmed = values.map((value) => value.trim()).filter(Boolean);
  if (trimmed.length === 0) return "";

  const wordLists = trimmed.map((value) => tokenizeWords(value));
  const minLen = Math.min(...wordLists.map((words) => words.length));
  const shared: string[] = [];

  for (let index = 0; index < minLen; index++) {
    const wordLower = wordLists[0][index].toLowerCase();
    if (wordLists.every((words) => words[index].toLowerCase() === wordLower)) {
      shared.push(wordLists[0][index]);
    } else {
      break;
    }
  }

  return shared.join(" ");
}

export function suffixAfterWordPrefix(value: string, prefix: string): string {
  const trimmed = value.trim();
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) return trimmed;

  const valueLower = trimmed.toLowerCase();
  const prefixLower = normalizedPrefix.toLowerCase();
  if (valueLower === prefixLower) return "";
  if (valueLower.startsWith(`${prefixLower} `)) {
    const prefixWords = tokenizeWords(normalizedPrefix);
    return tokenizeWords(trimmed).slice(prefixWords.length).join(" ").trim();
  }

  return trimmed;
}

/** Card set names must not end with the leading token of their parallel suffixes. */
export function cardSetNameParallelWordsDisjoint(
  setName: string,
  parallelSuffixes: string[]
): boolean {
  const setTokens = new Set(
    tokenizeWords(setName).map((word) => word.toLowerCase())
  );

  for (const suffix of parallelSuffixes) {
    if (!suffix.trim()) continue;
    const leadingToken = tokenizeWords(suffix)[0];
    if (leadingToken && setTokens.has(leadingToken.toLowerCase())) return false;
  }

  return true;
}

export function suffixesFormParallelFamily(suffixes: string[]): boolean {
  const hasEmpty = suffixes.some((suffix) => !suffix.trim());
  const nonEmpty = suffixes.map((suffix) => suffix.trim()).filter(Boolean);
  const unique = [...new Set(nonEmpty.map((suffix) => suffix.toLowerCase()))];

  if (nonEmpty.length === 0) return false;

  // Base insert row plus one or more parallel suffixes (e.g. "" + "Black" + "Gold").
  if (hasEmpty && nonEmpty.length >= 1) return true;

  if (unique.length < 2 && !hasEmpty) return false;

  const stem = longestCommonWordPrefix(nonEmpty);
  if (
    stem &&
    nonEmpty.every(
      (suffix) =>
        suffix.toLowerCase() === stem.toLowerCase() ||
        suffix.toLowerCase().startsWith(`${stem.toLowerCase()} `)
    )
  ) {
    return true;
  }

  // Sibling parallels without a shared stem (e.g. "Black" and "Gold").
  if (unique.length >= 2) return true;

  const sorted = [...nonEmpty].sort((a, b) => a.length - b.length);
  const shortest = sorted[0].toLowerCase();
  return sorted.every(
    (suffix) =>
      suffix.toLowerCase() === shortest ||
      suffix.toLowerCase().startsWith(`${shortest} `)
  );
}

function parallelSuffixesHaveInvalidHierarchy(suffixes: string[]): boolean {
  const hasEmpty = suffixes.some((suffix) => !suffix.trim());
  if (hasEmpty) return false;

  const nonEmpty = suffixes.map((suffix) => suffix.trim()).filter(Boolean);
  if (nonEmpty.length < 2) return false;

  for (const suffix of nonEmpty) {
    const suffixLower = suffix.toLowerCase();
    const isPrefixOfAnother = nonEmpty.some(
      (other) =>
        other.toLowerCase() !== suffixLower &&
        other.toLowerCase().startsWith(`${suffixLower} `)
    );
    if (!isPrefixOfAnother) continue;

    const stem = longestCommonWordPrefix(nonEmpty);
    const stemLower = stem.toLowerCase();
    if (
      !stem ||
      !nonEmpty.every(
        (other) =>
          other.toLowerCase() === stemLower ||
          other.toLowerCase().startsWith(`${stemLower} `)
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * When sibling CARD SET values share a prefix and vary only by parallel suffixes,
 * return the card set name (e.g. "Optic Rated Rookies" not "Optic Rated Rookies Preview").
 */
export function findSharedCardSetNameFromValues(
  members: string[],
  minSetNameWords = 2
): string | null {
  const values = [...new Set(members.map((member) => member.trim()).filter(Boolean))];
  if (values.length < 2) return null;

  const wordLists = values.map((value) => tokenizeWords(value));
  const maxPrefixWords = Math.max(...wordLists.map((words) => words.length));

  const valid: Array<{ prefix: string; wordCount: number; hasExactMatch: boolean }> =
    [];

  for (
    let wordCount = minSetNameWords;
    wordCount <= maxPrefixWords;
    wordCount++
  ) {
    const prefix = wordLists[0].slice(0, wordCount).join(" ");
    const prefixLower = prefix.toLowerCase();

    if (
      !values.every(
        (value) =>
          value.toLowerCase() === prefixLower ||
          value.toLowerCase().startsWith(`${prefixLower} `)
      )
    ) {
      continue;
    }

    const parallelSuffixes = values.map((value) =>
      suffixAfterWordPrefix(value, prefix)
    );
    if (new Set(values.map((value) => value.toLowerCase())).size < 2) continue;
    if (parallelSuffixesContainExclusiveInsertTokens(parallelSuffixes)) continue;
    if (prefix.trimEnd().endsWith("-")) continue;
    if (!suffixesFormParallelFamily(parallelSuffixes)) continue;
    if (!cardSetNameParallelWordsDisjoint(prefix, parallelSuffixes)) continue;
    if (parallelSuffixesHaveInvalidHierarchy(parallelSuffixes)) continue;

    valid.push({
      prefix,
      wordCount,
      hasExactMatch: values.some(
        (value) => value.toLowerCase() === prefixLower
      ),
    });
  }

  if (valid.length === 0) return null;

  const withExactMatch = valid.filter((candidate) => candidate.hasExactMatch);
  const pool = withExactMatch.length > 0 ? withExactMatch : valid;

  pool.sort((a, b) => {
    if (withExactMatch.length > 0) {
      return a.wordCount - b.wordCount || a.prefix.length - b.prefix.length;
    }
    return b.wordCount - a.wordCount || b.prefix.length - a.prefix.length;
  });

  return pool[0]?.prefix ?? null;
}

function isSingleWordPrizmsParallelFamily(
  members: string[],
  setName: string
): boolean {
  if (tokenizeWords(setName).length !== 1) return false;

  const suffixes = members.map((member) => suffixAfterWordPrefix(member, setName));
  if (!suffixesFormParallelFamily(suffixes)) return false;

  return suffixes.every(
    (suffix) => !suffix.trim() || /\bprizms\b/i.test(suffix)
  );
}

export function buildSiblingParallelFamilySplitIndex(
  distinctValues: string[]
): Map<string, { cardSetName: string; parallel?: string }> {
  const values = [
    ...new Set(distinctValues.map((value) => value.trim()).filter(Boolean)),
  ];
  const index = new Map<string, { cardSetName: string; parallel?: string }>();
  const assigned = new Set<string>();

  const candidateGroups: string[][] = [];

  for (const root of findCardSetRootsForProduct(values)) {
    candidateGroups.push(
      values.filter((value) => value === root || value.startsWith(`${root} `))
    );
  }

  const buckets = new Map<string, string[]>();
  for (const value of values) {
    if (shouldPreserveAtomicCardSetValue(value)) continue;
    const firstWord = tokenizeWords(value)[0]?.toLowerCase();
    if (!firstWord) continue;
    if (!buckets.has(firstWord)) buckets.set(firstWord, []);
    buckets.get(firstWord)!.push(value);
  }

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;

    const singleWordSetName = findSharedCardSetNameFromValues(bucket, 1);
    if (
      singleWordSetName &&
      isSingleWordPrizmsParallelFamily(bucket, singleWordSetName)
    ) {
      candidateGroups.push(bucket);
      continue;
    }

    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const left = bucket[i];
        const right = bucket[j];
        const leftLower = left.toLowerCase();
        const rightLower = right.toLowerCase();
        if (
          leftLower.startsWith(`${rightLower} `) ||
          rightLower.startsWith(`${leftLower} `) ||
          tokenizeWords(longestCommonWordPrefix([left, right])).length >= 2
        ) {
          candidateGroups.push([left, right]);
        }
      }
    }
  }

  candidateGroups.sort((a, b) => b.length - a.length);

  const sharedSetNameCache = new Map<string, string | null>();
  const cachedSharedSetName = (members: string[]): string | null => {
    const key = [...new Set(members.map((member) => member.trim()).filter(Boolean))]
      .sort()
      .join("\0");
    if (!sharedSetNameCache.has(key)) {
      let sharedSetName = findSharedCardSetNameFromValues(members);
      if (!sharedSetName) {
        const singleWordSetName = findSharedCardSetNameFromValues(members, 1);
        if (
          singleWordSetName &&
          isSingleWordPrizmsParallelFamily(members, singleWordSetName)
        ) {
          sharedSetName = singleWordSetName;
        }
      }
      sharedSetNameCache.set(key, sharedSetName);
    }
    return sharedSetNameCache.get(key) ?? null;
  };

  const processedGroups = new Set<string>();

  for (const group of candidateGroups) {
    if (group.length < 2) continue;

    const groupKey = [...group].sort().join("\0");
    if (processedGroups.has(groupKey)) continue;
    processedGroups.add(groupKey);

    const sharedSetName = cachedSharedSetName(group);
    if (!sharedSetName) continue;

    const expanded = values.filter((value) => {
      const valueLower = value.toLowerCase();
      const setNameLower = sharedSetName.toLowerCase();
      return (
        valueLower === setNameLower ||
        valueLower.startsWith(`${setNameLower} `)
      );
    });

    const members =
      expanded.length >= 2 && cachedSharedSetName(expanded) === sharedSetName
        ? expanded
        : group.filter((value) => {
            const valueLower = value.toLowerCase();
            const setNameLower = sharedSetName.toLowerCase();
            return (
              valueLower === setNameLower ||
              valueLower.startsWith(`${setNameLower} `)
            );
          });

    if (members.length < 2) continue;
    if (cachedSharedSetName(members) !== sharedSetName) continue;

    for (const rawValue of members) {
      if (assigned.has(rawValue)) continue;
      if (shouldPreserveAtomicCardSetValue(rawValue)) continue;
      if (shouldPreserveCompoundInsertName(rawValue)) continue;

      let sharedName = sharedSetName;
      let parallel =
        suffixAfterWordPrefix(rawValue, sharedSetName) || undefined;
      const eliteGoldSplit = resolveEliteGoldAnchorSplit(rawValue, sharedSetName);
      if (eliteGoldSplit) {
        sharedName = eliteGoldSplit.cardSetName;
        parallel = eliteGoldSplit.parallel;
      }

      index.set(rawValue, {
        cardSetName: normalizeCardSetRootName(sharedName),
        parallel,
      });
      assigned.add(rawValue);
    }
  }

  return index;
}

function isExactBaseCombinedValue(value: string): boolean {
  const key = normalizeKey(value);
  return key === "base" || key.startsWith("base ");
}

function isBaseFastBreakCombinedValue(afterBase: string): boolean {
  const key = normalizeKey(afterBase);
  return key === "fast break" || key.startsWith("fast break ");
}

/** Compound parallel stems on Base Set (not embedded subsets). */
const BASE_COMPOUND_PARALLEL_PREFIXES = [
  "choice",
  "international",
  "mosaic",
  "press proof",
];

/** Product-line parallel tiers peeled from insert card set names (e.g. Autographs Mosaic Black). */
const INSERT_PARALLEL_TIER_MARKERS = ["mosaic", "fast break"];

function isBaseCompoundParallelCombinedValue(afterBase: string): boolean {
  const key = normalizeKey(afterBase);
  return BASE_COMPOUND_PARALLEL_PREFIXES.some(
    (prefix) => key === prefix || key.startsWith(`${prefix} `)
  );
}

function isBaseCompoundParallelStem(root: string): boolean {
  const rootKey = normalizeKey(root);
  return (
    rootKey === "fast break" ||
    rootKey.startsWith("fast break ") ||
    BASE_COMPOUND_PARALLEL_PREFIXES.some(
      (prefix) => rootKey === prefix || rootKey.startsWith(`${prefix} `)
    )
  );
}

function collectSubsetParallelSuffixes(
  subsetName: string,
  distinctValues: string[]
): string[] {
  const subsetKey = normalizeKey(subsetName);
  const basePrefix = `base ${subsetName}`;
  const basePrefixKey = normalizeKey(basePrefix);
  const suffixes = new Set<string>();

  for (const value of distinctValues) {
    const trimmed = value.trim();
    const valueKey = normalizeKey(trimmed);
    if (valueKey !== basePrefixKey && !valueKey.startsWith(`${basePrefixKey} `)) {
      continue;
    }
    const suffix = trimmed.slice(basePrefix.length).trim();
    if (suffix) suffixes.add(suffix);
  }

  return [...suffixes].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function resolveSubsetParallelRemainder(
  remainder: string,
  subsetName: string,
  distinctValues: string[]
): string | undefined {
  const trimmed = remainder.trim();
  if (!trimmed) return undefined;

  const suffixes = collectSubsetParallelSuffixes(subsetName, distinctValues);
  const remainderKey = normalizeKey(trimmed);

  for (const suffix of suffixes) {
    if (remainderKey === normalizeKey(suffix)) return suffix;
  }

  return trimmed;
}

const PARALLEL_STEM_WORDS = new Set([
  "aqua",
  "black",
  "blue",
  "choice",
  "gold",
  "green",
  "holo",
  "hyper",
  "neon",
  "orange",
  "pink",
  "purple",
  "red",
  "velocity",
  "white",
]);

function isParallelModifierStem(modifier: string): boolean {
  const words = tokenizeWords(modifier);
  if (words.length === 0) return false;
  if (words[0].toLowerCase() === "choice") return true;
  return words.length === 1 && PARALLEL_STEM_WORDS.has(words[0].toLowerCase());
}

/**
 * Move parallel-modifier stems (Choice, Gold, etc.) out of cardSetName when sibling
 * CARD SET values share a shorter insert root (e.g. Opti-Graphs Choice → Opti-Graphs).
 */
export function reconcileParallelModifierStemInSetName<
  T extends {
    cardSetName: string;
    parallel: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, distinctValues: string[], normalizationOptions?: CardSetRootNormalizationOptions): T {
  const cardSetName = split.cardSetName?.trim() ?? "";
  if (!cardSetName) return split;
  if (normalizeKey(cardSetName) === "elite gold") return split;

  const nameWords = tokenizeWords(cardSetName);
  if (nameWords.length < 2) return split;

  for (let stripCount = 1; stripCount < nameWords.length; stripCount++) {
    const modifier = nameWords.slice(-stripCount).join(" ");
    if (!isParallelModifierStem(modifier)) continue;

    const baseName = nameWords.slice(0, -stripCount).join(" ").trim();
    if (!baseName) continue;

    const baseKey = baseName.toLowerCase();
    const setNameKey = cardSetName.toLowerCase();
    const hasSiblingFamily = distinctValues.some((value) => {
      const valueKey = value.trim().toLowerCase();
      return valueKey.startsWith(`${baseKey} `) && valueKey !== setNameKey;
    });
    if (!hasSiblingFamily) continue;

    const existingParallel = split.parallel?.trim() ?? "";
    const nextParallel = existingParallel
      ? `${modifier} ${existingParallel}`.trim()
      : modifier;

    return {
      ...split,
      cardSetName: normalizeCardSetRootName(baseName, normalizationOptions),
      parallel: nextParallel,
    };
  }

  return split;
}

export function countCardSetPrefixFamilyMembers(
  prefix: string,
  distinctValues: string[]
): number {
  const prefixKey = prefix.trim().toLowerCase();
  if (!prefixKey) return 0;

  return distinctValues.filter((value) => {
    const valueKey = value.trim().toLowerCase();
    return valueKey === prefixKey || valueKey.startsWith(`${prefixKey} `);
  }).length;
}

/**
 * Peel Mosaic / Fast Break product-line tiers from insert roots when sibling CARD SET
 * values share a shorter insert name (e.g. Autographs Mosaic Black → Autographs / Mosaic Black).
 */
export function reconcileInsertParallelTierInSetName<
  T extends {
    cardSetName: string;
    parallel: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, rawValue: string, distinctValues: string[], normalizationOptions?: CardSetRootNormalizationOptions): T {
  const raw = rawValue.trim();
  if (!raw) return split;

  const rawWords = tokenizeWords(raw);
  if (rawWords.length < 2) return split;

  for (const tierMarker of INSERT_PARALLEL_TIER_MARKERS) {
    const tierWords = tokenizeWords(tierMarker);
    if (rawWords.length <= tierWords.length) continue;

    for (let index = 1; index <= rawWords.length - tierWords.length; index++) {
      const tierText = rawWords.slice(index, index + tierWords.length).join(" ");
      if (normalizeKey(tierText) !== tierMarker) continue;

      const insertRoot = rawWords.slice(0, index).join(" ").trim();
      if (!insertRoot || countCardSetPrefixFamilyMembers(insertRoot, distinctValues) < 2) {
        continue;
      }

      const suffix = rawWords.slice(index + tierWords.length).join(" ").trim();
      const tierParallel = suffix ? `${tierText} ${suffix}`.trim() : tierText;

      return {
        ...split,
        cardSetName: normalizeCardSetRootName(insertRoot, normalizationOptions),
        parallel: tierParallel,
      };
    }
  }

  const cardSetName = split.cardSetName?.trim() ?? "";
  if (!cardSetName || normalizeKey(cardSetName) === normalizeKey(raw)) {
    return split;
  }

  const nameWords = tokenizeWords(cardSetName);
  for (const tierMarker of INSERT_PARALLEL_TIER_MARKERS) {
    const tierWords = tokenizeWords(tierMarker);
    if (nameWords.length <= tierWords.length) continue;

    for (let index = 1; index <= nameWords.length - tierWords.length; index++) {
      const tierText = nameWords.slice(index, index + tierWords.length).join(" ");
      if (normalizeKey(tierText) !== tierMarker) continue;

      const insertRoot = nameWords.slice(0, index).join(" ").trim();
      if (!insertRoot || countCardSetPrefixFamilyMembers(insertRoot, distinctValues) < 2) {
        continue;
      }

      const trailingInName = nameWords
        .slice(index + tierWords.length)
        .join(" ")
        .trim();
      const existingParallel = split.parallel?.trim() ?? "";
      let nextParallel = tierText;
      if (trailingInName) nextParallel = `${tierText} ${trailingInName}`.trim();
      if (existingParallel) nextParallel = `${nextParallel} ${existingParallel}`.trim();

      return {
        ...split,
        cardSetName: normalizeCardSetRootName(insertRoot, normalizationOptions),
        parallel: nextParallel,
      };
    }
  }

  return split;
}

function isParallelStemOnlyRoot(root: string): boolean {
  const words = tokenizeWords(root);
  return words.length === 1 && PARALLEL_STEM_WORDS.has(words[0].toLowerCase());
}

/** Detect subset titles embedded in `Base …` CARD SET values (e.g. Base Rated Rookies). */
let baseEmbeddedSubsetNamesCache: {
  values: readonly string[];
  names: string[];
} | null = null;

export function findBaseEmbeddedSubsetNames(distinctValues: string[]): string[] {
  if (
    baseEmbeddedSubsetNamesCache &&
    sameStringList(baseEmbeddedSubsetNamesCache.values, distinctValues)
  ) {
    return baseEmbeddedSubsetNamesCache.names;
  }

  const afterBaseValues = distinctValues
    .map((value) => value.trim())
    .filter((value) => normalizeKey(value).startsWith("base "))
    .map((value) => value.replace(/^base\s+/i, "").trim())
    .filter(Boolean)
    .filter((value) => !normalizeKey(value).startsWith("set - "));

  if (afterBaseValues.length < 2) {
    baseEmbeddedSubsetNamesCache = { values: distinctValues, names: [] };
    return [];
  }

  const names = findCardSetRoots(afterBaseValues)
    .filter((root) => {
      const rootKey = normalizeKey(root);
      if (
        !rootKey ||
        rootKey.startsWith("set - ") ||
        isParallelStemOnlyRoot(root) ||
        isBaseCompoundParallelStem(root)
      ) {
        return false;
      }

      const members = afterBaseValues.filter((value) => {
        const valueKey = normalizeKey(value);
        return valueKey === rootKey || valueKey.startsWith(`${rootKey} `);
      });
      return members.length >= 2;
    })
    .sort(
      (a, b) =>
        b.split(/\s+/).length - a.split(/\s+/).length || b.length - a.length
    );

  baseEmbeddedSubsetNamesCache = { values: distinctValues, names };
  return names;
}

export function splitBasePrefixedCombinedValue(
  rawValue: string,
  distinctValues: string[]
): { cardSetName: string; parallel?: string; cardSetCategory: string } | null {
  const trimmed = rawValue.trim();
  const selectBaseTierSplit = splitSelectBaseTierCombinedValue(trimmed);
  if (selectBaseTierSplit) return selectBaseTierSplit;

  const key = normalizeKey(trimmed);
  if (!isExactBaseCombinedValue(trimmed)) return null;

  const baseSetName = resolveBaseCardSetDisplayName(distinctValues);

  if (key === "base") {
    return {
      cardSetName: baseSetName,
      parallel: undefined,
      cardSetCategory: "Base Set",
    };
  }

  const afterBase = trimmed.slice(5).trim();
  if (!afterBase) {
    return {
      cardSetName: baseSetName,
      parallel: undefined,
      cardSetCategory: "Base Set",
    };
  }

  if (isBaseFastBreakCombinedValue(afterBase)) {
    return {
      cardSetName: baseSetName,
      parallel: afterBase,
      cardSetCategory: "Base Set",
    };
  }

  if (isBaseCompoundParallelCombinedValue(afterBase)) {
    return {
      cardSetName: baseSetName,
      parallel: afterBase,
      cardSetCategory: "Base Set",
    };
  }

  if (usesHoopsCardSetRules(distinctValues)) {
    const hoopsTributeMatch = afterBase.match(/^Hoops Tribute(?:\s+(.*))?$/i);
    if (hoopsTributeMatch) {
      return {
        cardSetName: "Hoops Tribute",
        parallel: hoopsTributeMatch[1]?.trim() || undefined,
        cardSetCategory: "Subset",
      };
    }

    const rookiesMatch = afterBase.match(/^Rookies(?:\s+(.*))?$/i);
    if (rookiesMatch) {
      return {
        cardSetName: "Rookies",
        parallel: rookiesMatch[1]?.trim() || undefined,
        cardSetCategory: "Subset",
      };
    }

    return {
      cardSetName: baseSetName,
      parallel: afterBase || undefined,
      cardSetCategory: "Base Set",
    };
  }

  for (const subsetName of findBaseEmbeddedSubsetNames(distinctValues)) {
    const subsetKey = normalizeKey(subsetName);
    const afterKey = normalizeKey(afterBase);
    if (afterKey === subsetKey || afterKey.startsWith(`${subsetKey} `)) {
      const remainder =
        afterKey === subsetKey
          ? ""
          : afterBase.slice(subsetName.length).trim();
      const parallel = resolveSubsetParallelRemainder(
        remainder,
        subsetName,
        distinctValues
      );
      return {
        cardSetName:
          (usesHoopsCardSetRules(distinctValues) ||
            usesSpectraCardSetRules(distinctValues)) &&
          baseSetName === "Base"
            ? `Base ${subsetName}`
            : subsetName,
        parallel,
        cardSetCategory: "Subset",
      };
    }
  }

  return {
    cardSetName: baseSetName,
    parallel: afterBase,
    cardSetCategory: "Base Set",
  };
}

export function buildBasePrefixedSplitIndex(
  distinctValues: string[]
): Map<string, { cardSetName: string; parallel?: string; cardSetCategory: string }> {
  const index = new Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >();

  for (const rawValue of distinctValues) {
    const split = splitBasePrefixedCombinedValue(rawValue, distinctValues);
    if (split) {
      index.set(rawValue, split);
    }
  }

  return index;
}

export type CardSetRootNormalizationOptions = {
  baseSetDisplayName?: string;
};

export function reconcileCardSetSplitDisjointWords<
  T extends {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, normalizationOptions?: CardSetRootNormalizationOptions): T {
  let cardSetName = split.cardSetName?.trim() ?? "";
  let parallel = split.parallel?.trim() ?? "";
  if (!cardSetName || !parallel) return split;

  let changed = true;
  let guard = 0;
  while (changed && guard++ < tokenizeWords(cardSetName).length + 8) {
    changed = false;
    const nameWords = tokenizeWords(cardSetName);

    let overlapIndex = nameWords.length;
    for (let index = 0; index < nameWords.length; index++) {
      const moveWords = nameWords.slice(index);
      const moveText = moveWords.join(" ").toLowerCase();
      if (
        moveText &&
        parallel.toLowerCase().startsWith(moveText) &&
        moveText !== parallel.toLowerCase()
      ) {
        overlapIndex = index;
        break;
      }
    }

    if (overlapIndex === nameWords.length) break;

    const moveWords = nameWords.slice(overlapIndex);
    const nextName = nameWords.slice(0, overlapIndex).join(" ").trim();
    if (!nextName) break;

    const moveText = moveWords.join(" ");
    cardSetName = normalizeCardSetRootName(nextName, normalizationOptions);
    if (!parallel.toLowerCase().startsWith(moveText.toLowerCase())) {
      parallel = `${moveText} ${parallel}`.trim();
    }
    changed = true;
  }

  if (
    cardSetName === split.cardSetName &&
    (parallel || undefined) === (split.parallel?.trim() || undefined)
  ) {
    return split;
  }

  return {
    ...split,
    cardSetName,
    parallel: parallel || null,
  };
}

export type Dm2CardSetSplitCorrectionCaches = {
  siblingIndex?: Map<string, { cardSetName: string; parallel?: string }>;
  baseIndex?: Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >;
  spectraIndex?: Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >;
  crossProductIndex?: Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >;
  spectraProductLineBaseIndex?: Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >;
  selectPrizmsBaseIndex?: Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >;
  baseSetDisplayName?: string;
  usesSpectraCardSetRules?: boolean;
};

const COMPOUND_INSERT_NAME_KEYS = new Set([
  "elite dominators",
  "elite dominators signatures",
  "white hot rookies",
  "white hot stars",
]);

function shouldPreserveCompoundInsertName(value: string): boolean {
  const key = normalizeKey(normalizeSelectRawCardSetValue(value));
  if (COMPOUND_INSERT_NAME_KEYS.has(key)) return true;
  if (isMosaicPreservedCompoundInsertPattern(value)) return true;
  return isHoopsPreservedCompoundInsertPattern(value);
}

export function shouldSkipExclusiveResplitForRawValue(rawValue: string): boolean {
  const trimmed = rawValue.trim();
  if (!trimmed) return false;
  if (shouldPreserveCompoundInsertName(trimmed)) return true;
  if (/^Status .+ Die-Cut Signatures$/i.test(trimmed)) return true;
  if (/^Timeless Treasures Prime Jersey Autographs$/i.test(trimmed)) return true;
  if (isHoopsPreservedCompoundInsertPattern(trimmed)) return true;
  if (isMosaicPreservedCompoundInsertPattern(trimmed)) return true;
  return false;
}

const ELITE_GOLD_PARALLEL_SUFFIX_KEYS = new Set([
  "gold",
  "purple",
  "red",
  "jersey number die cuts",
  "status die-cuts",
]);

function resolveEliteGoldAnchorSplit(
  rawValue: string,
  sharedSetName: string
): { cardSetName: string; parallel?: string } | null {
  if (normalizeKey(sharedSetName) !== "elite") return null;

  const rawKey = normalizeKey(rawValue);
  const suffix = suffixAfterWordPrefix(rawValue, "Elite");
  if (!ELITE_GOLD_PARALLEL_SUFFIX_KEYS.has(normalizeKey(suffix))) {
    return null;
  }

  return {
    cardSetName: "Elite Gold",
    parallel: rawKey === "elite gold" ? "Gold" : suffix || undefined,
  };
}

function reconcileEliteGoldAnchorFamily<
  T extends {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, rawValue: string): T {
  const anchored = resolveEliteGoldAnchorSplit(rawValue, "Elite");
  if (!anchored) return split;

  return {
    ...split,
    cardSetName: anchored.cardSetName,
    parallel: anchored.parallel ?? null,
  };
}

function reconcileTimelessTreasuresPrimeAutographSplit<
  T extends {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, rawValue: string): T {
  if (!/^Timeless Treasures Prime Jersey Autographs$/i.test(rawValue.trim())) {
    return split;
  }

  return {
    ...split,
    cardSetName: "Timeless Treasures Jersey Autographs",
    parallel: "Prime",
    cardSetCategory: split.cardSetCategory ?? "Insert",
  };
}

const SELECT_CARD_SET_RAW_SPLITS: Array<{
  pattern: RegExp;
  cardSetName: string;
  parallel: string | null;
  cardSetCategory: string;
}> = [
  {
    pattern: /^Select Stars Prime Jersey Prizms Gold Autographs$/i,
    cardSetName: "Select Stars Jersey Autographs",
    parallel: "Prime Prizms Gold",
    cardSetCategory: "Insert",
  },
  {
    pattern: /^Select Stars Prime Jersey Prizms Autographs$/i,
    cardSetName: "Select Stars Jersey Autographs",
    parallel: "Prime Prizms",
    cardSetCategory: "Insert",
  },
  {
    pattern: /^Select Stars Jersey Prizms Autographs$/i,
    cardSetName: "Select Stars Jersey Autographs",
    parallel: "Prizms",
    cardSetCategory: "Insert",
  },
  {
    pattern: /^Rookie Jersey Prizms Gold Autographs$/i,
    cardSetName: "Rookie Jersey Autographs",
    parallel: "Prizms Gold",
    cardSetCategory: "Subset",
  },
  {
    pattern: /^Rookie Jersey Prizms Black Autographs$/i,
    cardSetName: "Rookie Jersey Autographs",
    parallel: "Prizms Black",
    cardSetCategory: "Subset",
  },
  {
    pattern: /^Rookie Jersey Prizms Autographs$/i,
    cardSetName: "Rookie Jersey Autographs",
    parallel: "Prizms",
    cardSetCategory: "Subset",
  },
  {
    pattern: /^Rookie Prizms Gold Autographs$/i,
    cardSetName: "Rookie Autographs",
    parallel: "Prizms Gold",
    cardSetCategory: "Subset",
  },
  {
    pattern: /^Rookie Prizms Black Autographs$/i,
    cardSetName: "Rookie Autographs",
    parallel: "Prizms Black",
    cardSetCategory: "Subset",
  },
  {
    pattern: /^Rookie Prizm Autographs$/i,
    cardSetName: "Rookie Autographs",
    parallel: "Prizms",
    cardSetCategory: "Subset",
  },
  {
    pattern: /^Rookie Jersey Autographs$/i,
    cardSetName: "Rookie Jersey Autographs",
    parallel: null,
    cardSetCategory: "Subset",
  },
  {
    pattern: /^Rookie Autographs$/i,
    cardSetName: "Rookie Autographs",
    parallel: null,
    cardSetCategory: "Subset",
  },
  {
    pattern: /^White Hot Prizms Rookies$/i,
    cardSetName: "White Hot Rookies",
    parallel: "Prizms",
    cardSetCategory: "Insert",
  },
];

function reconcileSelectCardSetSplit<
  T extends {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, rawValue: string, distinctValues: string[]): T {
  if (!usesSelectCardSetRules(distinctValues)) return split;

  const raw = normalizeSelectRawCardSetValue(rawValue);
  const rawOriginal = rawValue.trim();

  for (const entry of SELECT_CARD_SET_RAW_SPLITS) {
    if (!entry.pattern.test(raw)) continue;
    return {
      ...split,
      cardSetName: entry.cardSetName,
      parallel: entry.parallel,
      cardSetCategory: entry.cardSetCategory,
    };
  }

  const whiteHotStarsPrizms = rawOriginal.match(/^(White Hot\s+Stars)\s+Prizms$/i);
  if (whiteHotStarsPrizms) {
    return {
      ...split,
      cardSetName: whiteHotStarsPrizms[1].trim(),
      parallel: "Prizms",
      cardSetCategory: "Insert",
    };
  }

  return split;
}

function applyContextualParallelNormalization<
  T extends {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, options?: {
  usesMosaicCardSetRules?: boolean;
  mosaicProgramVariant?: "2023" | "2024" | null;
  rawValue?: string;
}): T {
  const normalized = normalizeParallelOutput(split);
  const cardSetKey = normalizeKey(normalized.cardSetName);
  const parallel = normalized.parallel?.trim() ?? "";

  if (cardSetKey === "rated rookies" && /^Jersey Numbers$/i.test(parallel)) {
    return { ...normalized, parallel: "Jersey Number" };
  }

  if (cardSetKey === "rated rookies" && /^Blue Press Proofs$/i.test(parallel)) {
    return { ...normalized, parallel: "Blue Press Proof" };
  }

  if (cardSetKey === "the rookies" && /^Jersey Number$/i.test(parallel)) {
    return { ...normalized, parallel: "Jersey Numbers" };
  }

  if (
    cardSetKey === "court kings" &&
    /^Years in the League Stat Line$/i.test(parallel)
  ) {
    return { ...normalized, parallel: "Years in the Leage Stat Line" };
  }

  if (parallel && options?.usesMosaicCardSetRules) {
    return {
      ...normalized,
      parallel: normalizeMosaicParallelCasing(
        parallel,
        normalized.cardSetName,
        options.rawValue,
        options.mosaicProgramVariant ?? null
      ),
    };
  }

  return normalized;
}

export function applyRawValueCardSetSplitCorrections(
  split: {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
  rawValue: string,
  distinctValues: string[],
  options?: { usesSpectraCardSetRules?: boolean }
): {
  cardSetName: string;
  parallel: string | null;
  cardSetCategory: string | null;
} {
  const trimmedRaw = normalizeSelectRawCardSetValue(rawValue);
  const usesSpectraRules =
    options?.usesSpectraCardSetRules ?? usesSpectraCardSetRules(distinctValues);

  if (shouldPreserveCompoundInsertName(trimmedRaw)) {
    const mosaicCompound = splitMosaicCardSetCombinedValue(trimmedRaw, distinctValues);
    if (mosaicCompound) {
      return {
        cardSetName: mosaicCompound.cardSetName,
        parallel: mosaicCompound.parallel ?? null,
        cardSetCategory: mosaicCompound.cardSetCategory,
      };
    }
    const hoopsCompound = splitHoopsCardSetCombinedValue(trimmedRaw, distinctValues);
    if (hoopsCompound) {
      return {
        cardSetName: hoopsCompound.cardSetName,
        parallel: hoopsCompound.parallel ?? null,
        cardSetCategory: hoopsCompound.cardSetCategory,
      };
    }
    return {
      cardSetName: trimmedRaw,
      parallel: null,
      cardSetCategory: "Insert",
    };
  }

  const mosaicSplit = splitMosaicCardSetCombinedValue(trimmedRaw, distinctValues);
  if (mosaicSplit) {
    return {
      cardSetName: mosaicSplit.cardSetName,
      parallel: mosaicSplit.parallel ?? null,
      cardSetCategory: mosaicSplit.cardSetCategory,
    };
  }

  const hoopsSplit = splitHoopsCardSetCombinedValue(trimmedRaw, distinctValues);
  if (hoopsSplit) {
    return {
      cardSetName: hoopsSplit.cardSetName,
      parallel: hoopsSplit.parallel ?? null,
      cardSetCategory: hoopsSplit.cardSetCategory,
    };
  }

  const selectBaseSplit = splitSelectPrizmsBaseCombinedValue(
    trimmedRaw,
    distinctValues
  );

  let next = selectBaseSplit
    ? {
        cardSetName: selectBaseSplit.cardSetName,
        parallel: selectBaseSplit.parallel ?? null,
        cardSetCategory: selectBaseSplit.cardSetCategory,
      }
    : {
        ...split,
        parallel: split.parallel ?? null,
      };

  next = reconcileSelectCardSetSplit(next, rawValue.trim(), distinctValues);
  next = reconcileTimelessTreasuresPrimeAutographSplit(next, trimmedRaw);
  next = reconcileEliteGoldAnchorFamily(next, trimmedRaw);
  next = reconcileProductionLineStatDimensionSplit(next, trimmedRaw);
  next = reconcileStatusDieCutSignaturesSplit(next, trimmedRaw);
  next = applyContextualParallelNormalization(next, {
    usesMosaicCardSetRules: usesMosaicCardSetRules(distinctValues),
    mosaicProgramVariant: resolveMosaicProgramVariant(distinctValues),
    rawValue: trimmedRaw,
  });

  return {
    cardSetName: next.cardSetName,
    parallel: next.parallel ?? null,
    cardSetCategory: resolveFinalCardSetCategory(
      next.cardSetName,
      trimmedRaw,
      next.cardSetCategory,
      { usesSpectraCardSetRules: usesSpectraRules }
    ),
  };
}

function reconcileStatusDieCutSignaturesSplit<
  T extends {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, rawValue: string): T {
  const match = rawValue.trim().match(/^Status (.+?) Die-Cut Signatures$/i);
  if (!match) return split;

  const tier = match[1].trim();
  const parallel =
    normalizeKey(tier) === "red"
      ? "Red Die-Cut Signatures"
      : `${tier} Die-Cut`;

  return {
    ...split,
    cardSetName: "Status Signatures",
    parallel,
  };
}

function reconcileProductionLineStatDimensionSplit<
  T extends {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, rawValue: string): T {
  const raw = rawValue.trim();

  const statLineMatch = raw.match(
    /^Production Line (Career|Season) Stat Line\s*-+\s*(Assists|Scoring|Rebounds)$/i
  );
  if (statLineMatch) {
    return {
      ...split,
      cardSetName: `Production Line - ${statLineMatch[2]}`,
      parallel: `${statLineMatch[1]} Stat Line`,
    };
  }

  const blueMatch = raw.match(
    /^Production Line Blue Press Proofs\s*-+\s*(Assists|Scoring|Rebounds)$/i
  );
  if (blueMatch) {
    return {
      ...split,
      cardSetName: `Production Line - ${blueMatch[1]}`,
      parallel: "Blue Press Proofs",
    };
  }

  const colorMatch = raw.match(
    /^Production Line (Black|Gold|Purple|Silver) Press Proofs\s*-+\s*(Assists|Scoring|Rebounds)$/i
  );
  if (colorMatch) {
    return {
      ...split,
      cardSetName: `Production Line - ${colorMatch[2]}`,
      parallel: `${colorMatch[1]} Press Proof`,
    };
  }

  return split;
}

function normalizeDonrussParallelSuffix(parallel: string): string {
  const trimmed = parallel.trim();
  if (!trimmed) return trimmed;
  if (/^Blue Press Proofs$/i.test(trimmed)) return trimmed;

  const replacements: Array<[RegExp, string]> = [
    [/^Artists Proofs$/i, "Artist Proof"],
    [/^Purple Press Proofs$/i, "Purple Press Proof"],
    [/ (Black|Gold|Purple|Silver) Press Proofs$/i, " $1 Press Proof"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(trimmed)) return replacement;
  }

  return trimmed;
}

function normalizeParallelOutput<
  T extends {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
>(split: T): T {
  const parallel = split.parallel?.trim();
  if (!parallel) return split;

  return {
    ...split,
    parallel: normalizeDonrussParallelSuffix(parallel),
  };
}

/** Rated Rookie International * → Rated Rookies subset + International … parallel. */
function reconcileRatedRookiesInternationalSplit<
  T extends {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
>(split: T, rawValue: string): T {
  const match = rawValue
    .trim()
    .match(/^Rated Rookie(?:s)?\s+(International\s+.+)$/i);
  if (!match) return split;

  return {
    ...split,
    cardSetName: "Rated Rookies",
    parallel: match[1].trim(),
    cardSetCategory: split.cardSetCategory ?? "Subset",
  };
}

function runP0ReconciliationPipeline(
  split: {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
  rawValue: string,
  distinctValues: string[],
  baseSetDisplayName: string,
  usesSpectraRules: boolean
): {
  cardSetName: string;
  parallel: string | null;
  cardSetCategory: string | null;
} {
  const trimmedRaw = rawValue.trim();

  const reconciledExclusive = reconcileCardSetNameExclusiveParallelSplit({
    cardSetName: split.cardSetName,
    parallel: split.parallel ?? null,
    cardSetCategory: split.cardSetCategory,
  });

  const reconciled = reconcileCardSetSplitDisjointWords(
    {
      cardSetName: reconciledExclusive.cardSetName,
      parallel: reconciledExclusive.parallel,
      cardSetCategory: reconciledExclusive.cardSetCategory,
    },
    { baseSetDisplayName }
  );

  const finalExclusive = reconcileCardSetNameExclusiveParallelSplit(reconciled);
  const modifierAdjusted = reconcileParallelModifierStemInSetName(
    finalExclusive,
    distinctValues,
    { baseSetDisplayName }
  );
  const skipInsertTierReconcile =
    (split.cardSetCategory === "Subset" ||
      reconciledExclusive.cardSetCategory === "Subset") &&
    /^base\s+/i.test(trimmedRaw);
  const tierAdjusted = skipInsertTierReconcile
    ? modifierAdjusted
    : reconcileInsertParallelTierInSetName(
        modifierAdjusted,
        trimmedRaw,
        distinctValues,
        { baseSetDisplayName }
      );
  const ratedRookiesAdjusted = reconcileRatedRookiesInternationalSplit(
    tierAdjusted,
    trimmedRaw
  );
  const eliteGoldAdjusted = reconcileEliteGoldAnchorFamily(
    ratedRookiesAdjusted,
    trimmedRaw
  );
  const productionLineAdjusted = reconcileProductionLineStatDimensionSplit(
    eliteGoldAdjusted,
    trimmedRaw
  );
  const timelessAdjusted = reconcileTimelessTreasuresPrimeAutographSplit(
    productionLineAdjusted,
    trimmedRaw
  );
  const statusAdjusted = reconcileStatusDieCutSignaturesSplit(
    timelessAdjusted,
    trimmedRaw
  );
  const selectAdjusted = reconcileSelectCardSetSplit(
    statusAdjusted,
    rawValue.trim(),
    distinctValues
  );
  const normalizedParallel = applyContextualParallelNormalization(selectAdjusted, {
    usesMosaicCardSetRules: usesMosaicCardSetRules(distinctValues),
    mosaicProgramVariant: resolveMosaicProgramVariant(distinctValues),
    rawValue: trimmedRaw,
  });

  return {
    cardSetName: normalizeCardSetRootName(normalizedParallel.cardSetName, {
      baseSetDisplayName,
    }),
    parallel: normalizedParallel.parallel ?? null,
    cardSetCategory: resolveFinalCardSetCategory(
      normalizedParallel.cardSetName,
      rawValue,
      normalizedParallel.cardSetCategory,
      { usesSpectraCardSetRules: usesSpectraRules }
    ),
  };
}

export function applyP0CardSetSplitCorrections(
  split: {
    cardSetName: string;
    parallel?: string | null;
    cardSetCategory?: string | null;
  },
  rawValue: string,
  distinctValues: string[],
  caches?: Dm2CardSetSplitCorrectionCaches
): {
  cardSetName: string;
  parallel: string | null;
  cardSetCategory: string | null;
} {
  const trimmedRaw = normalizeSelectRawCardSetValue(rawValue);
  const baseSetDisplayName =
    caches?.baseSetDisplayName ?? resolveBaseCardSetDisplayName(distinctValues);
  const usesSpectraRules =
    caches?.usesSpectraCardSetRules ?? usesSpectraCardSetRules(distinctValues);

  if (shouldPreserveCompoundInsertName(trimmedRaw)) {
    const mosaicCompound = splitMosaicCardSetCombinedValue(trimmedRaw, distinctValues);
    if (mosaicCompound) {
      return {
        cardSetName: mosaicCompound.cardSetName,
        parallel: mosaicCompound.parallel ?? null,
        cardSetCategory: mosaicCompound.cardSetCategory,
      };
    }
    const hoopsCompound = splitHoopsCardSetCombinedValue(trimmedRaw, distinctValues);
    if (hoopsCompound) {
      return {
        cardSetName: hoopsCompound.cardSetName,
        parallel: hoopsCompound.parallel ?? null,
        cardSetCategory: hoopsCompound.cardSetCategory,
      };
    }
    return {
      cardSetName: trimmedRaw,
      parallel: null,
      cardSetCategory: "Insert",
    };
  }

  const mosaicSplit = splitMosaicCardSetCombinedValue(trimmedRaw, distinctValues);
  if (mosaicSplit) {
    return {
      cardSetName: mosaicSplit.cardSetName,
      parallel: mosaicSplit.parallel ?? null,
      cardSetCategory: mosaicSplit.cardSetCategory,
    };
  }

  const hoopsSplit = splitHoopsCardSetCombinedValue(trimmedRaw, distinctValues);
  if (hoopsSplit) {
    return {
      cardSetName: hoopsSplit.cardSetName,
      parallel: hoopsSplit.parallel ?? null,
      cardSetCategory: hoopsSplit.cardSetCategory,
    };
  }

  const selectPrizmsBaseSplit =
    caches?.selectPrizmsBaseIndex?.get(trimmedRaw) ??
    caches?.selectPrizmsBaseIndex?.get(rawValue.trim()) ??
    splitSelectPrizmsBaseCombinedValue(trimmedRaw, distinctValues);
  if (selectPrizmsBaseSplit) {
    return runP0ReconciliationPipeline(
      {
        cardSetName: selectPrizmsBaseSplit.cardSetName,
        parallel: selectPrizmsBaseSplit.parallel ?? null,
        cardSetCategory: selectPrizmsBaseSplit.cardSetCategory,
      },
      rawValue,
      distinctValues,
      baseSetDisplayName,
      usesSpectraRules
    );
  }

  const selectRawSplit = reconcileSelectCardSetSplit(
    {
      cardSetName: split.cardSetName,
      parallel: split.parallel ?? null,
      cardSetCategory: split.cardSetCategory,
    },
    rawValue.trim(),
    distinctValues
  );
  if (
    selectRawSplit.cardSetName !== split.cardSetName ||
    selectRawSplit.parallel !== (split.parallel ?? null) ||
    selectRawSplit.cardSetCategory !== split.cardSetCategory
  ) {
    return runP0ReconciliationPipeline(
      selectRawSplit,
      rawValue,
      distinctValues,
      baseSetDisplayName,
      usesSpectraRules
    );
  }

  const spectraSplit =
    caches?.spectraIndex?.get(trimmedRaw) ??
    splitSpectraCrossYearCombinedValue(trimmedRaw, distinctValues);
  if (spectraSplit) {
    return runP0ReconciliationPipeline(
      {
        cardSetName: spectraSplit.cardSetName,
        parallel: spectraSplit.parallel ?? null,
        cardSetCategory: spectraSplit.cardSetCategory,
      },
      rawValue,
      distinctValues,
      baseSetDisplayName,
      usesSpectraRules
    );
  }

  const crossProductSplit =
    caches?.crossProductIndex?.get(trimmedRaw) ??
    splitCrossProductYearCombinedValue(trimmedRaw, distinctValues);
  if (crossProductSplit) {
    return runP0ReconciliationPipeline(
      {
        cardSetName: crossProductSplit.cardSetName,
        parallel: crossProductSplit.parallel ?? null,
        cardSetCategory: crossProductSplit.cardSetCategory,
      },
      rawValue,
      distinctValues,
      baseSetDisplayName,
      usesSpectraRules
    );
  }

  const mosaicSplitEarly = splitMosaicCardSetCombinedValue(trimmedRaw, distinctValues);
  if (mosaicSplitEarly) {
    return runP0ReconciliationPipeline(
      {
        cardSetName: mosaicSplitEarly.cardSetName,
        parallel: mosaicSplitEarly.parallel ?? null,
        cardSetCategory: mosaicSplitEarly.cardSetCategory,
      },
      rawValue,
      distinctValues,
      baseSetDisplayName,
      usesSpectraRules
    );
  }

  const spectraProductLineBaseSplit =
    caches?.spectraProductLineBaseIndex?.get(trimmedRaw) ??
    splitSpectraProductLineBaseCombinedValue(trimmedRaw, distinctValues);
  if (spectraProductLineBaseSplit) {
    return runP0ReconciliationPipeline(
      {
        cardSetName: spectraProductLineBaseSplit.cardSetName,
        parallel: spectraProductLineBaseSplit.parallel ?? null,
        cardSetCategory: spectraProductLineBaseSplit.cardSetCategory,
      },
      rawValue,
      distinctValues,
      baseSetDisplayName,
      usesSpectraRules
    );
  }

  if (shouldPreserveAtomicCardSetValue(trimmedRaw)) {
    return {
      cardSetName: trimmedRaw,
      parallel: null,
      cardSetCategory:
        split.cardSetCategory ?? inferCardSetCategory(trimmedRaw, trimmedRaw),
    };
  }

  const siblingIndex =
    caches?.siblingIndex ?? buildSiblingParallelFamilySplitIndex(distinctValues);
  const siblingSplit = siblingIndex.get(trimmedRaw);

  let cardSetName = siblingSplit?.cardSetName ?? split.cardSetName;
  let parallel = siblingSplit
    ? (siblingSplit.parallel ?? null)
    : (split.parallel ?? null);
  let cardSetCategory =
    split.cardSetCategory ?? inferCardSetCategory(cardSetName, rawValue);

  const baseSplit =
    caches?.baseIndex?.get(trimmedRaw) ??
    splitBasePrefixedCombinedValue(trimmedRaw, distinctValues);
  if (baseSplit) {
    cardSetName = baseSplit.cardSetName;
    parallel = baseSplit.parallel ?? null;
    cardSetCategory = baseSplit.cardSetCategory;
  }

  return runP0ReconciliationPipeline(
    { cardSetName, parallel, cardSetCategory },
    rawValue,
    distinctValues,
    baseSetDisplayName,
    usesSpectraRules
  );
}

export function normalizeCardSetRootName(
  root: string,
  options?: { baseSetDisplayName?: string }
): string {
  const baseSetDisplayName = options?.baseSetDisplayName ?? "Base Set";
  const trimmed = root.trim();
  const key = normalizeKey(trimmed);
  if (key === "showtimes signatures") return "Showtime Signatures";
  if (key === "base" || key === "base set") return baseSetDisplayName;
  if (key.startsWith("base set - ")) return trimmed;
  if (key.startsWith("base ")) {
    const remainder = trimmed.replace(/^base\s+/i, "").trim();
    if (remainder.toLowerCase().startsWith("set -")) {
      return trimmed;
    }
    if (
      baseSetDisplayName === "Base" &&
      remainder.split(/\s+/).filter(Boolean).length > 1
    ) {
      return trimmed;
    }
    return remainder;
  }
  return trimmed;
}

function isRookieJerseyAutographsSubsetPattern(
  cardSetName: string,
  rawValue?: string
): boolean {
  const key = normalizeKey(cardSetName);
  const rawKey = rawValue ? normalizeKey(rawValue) : "";

  return (
    key === "rookie jersey autographs" ||
    key.startsWith("rookie jersey autographs ") ||
    key === "rookie jerseys autographs" ||
    key.startsWith("rookie jerseys autographs ") ||
    rawKey === "rookie jersey autographs" ||
    rawKey.startsWith("rookie jersey autographs ") ||
    rawKey === "rookie jerseys autographs" ||
    rawKey.startsWith("rookie jerseys autographs ")
  );
}

function isRatedRookiesSubsetPattern(cardSetName: string, rawValue?: string): boolean {
  const key = normalizeKey(cardSetName);
  const rawKey = rawValue ? normalizeKey(rawValue) : "";

  if (key.startsWith("optic rated rookies") || rawKey.startsWith("optic rated rookies")) {
    return false;
  }

  if (key === "rated rookies" || key.startsWith("rated rookies ")) {
    return true;
  }

  if (rawKey === "rated rookies" || rawKey.startsWith("rated rookies ")) {
    return true;
  }

  if (
    rawKey.startsWith("rated rookie ") &&
    !rawKey.includes("box topper") &&
    !rawKey.includes("signature patches")
  ) {
    return true;
  }

  return false;
}

function isOpticPreviewSubsetPattern(cardSetName: string, rawValue?: string): boolean {
  const key = normalizeKey(cardSetName);
  const rawKey = rawValue ? normalizeKey(rawValue) : "";
  return (
    key.startsWith("optic rated rookies preview") ||
    rawKey.startsWith("optic rated rookies preview")
  );
}

function isRookieVariationsSubsetPattern(
  cardSetName: string,
  rawValue?: string
): boolean {
  const key = normalizeKey(cardSetName);
  const rawKey = rawValue ? normalizeKey(normalizeSelectRawCardSetValue(rawValue)) : "";
  return key === "rookie variations" || rawKey.startsWith("rookie variations ");
}

export function resolveFinalCardSetCategory(
  cardSetName: string,
  rawValue: string,
  existing?: string | null,
  options?: { usesSpectraCardSetRules?: boolean }
): string {
  if (isOpticPreviewSubsetPattern(cardSetName, rawValue)) {
    return "Subset";
  }

  if (isRookieVariationsSubsetPattern(cardSetName, rawValue)) {
    return "Subset";
  }

  if (isRatedRookiesSubsetPattern(cardSetName, rawValue)) {
    return "Subset";
  }

  if (
    options?.usesSpectraCardSetRules &&
    isRookieJerseyAutographsSubsetPattern(cardSetName, rawValue)
  ) {
    return "Subset";
  }

  return existing ?? inferCardSetCategory(cardSetName, rawValue);
}

function isSignatureSubsetPattern(cardSetName: string, rawValue?: string): boolean {
  const key = normalizeKey(cardSetName);
  const rawKey = rawValue ? normalizeKey(rawValue) : "";

  if (rawKey.startsWith("base ")) {
    const afterBase = rawKey.slice(5).trim();
    if (
      afterBase.startsWith(`${key} `) ||
      afterBase === key ||
      tokenizeWords(cardSetName).some(isCardSetNameExclusiveToken)
    ) {
      return tokenizeWords(cardSetName).some(isCardSetNameExclusiveToken);
    }
  }

  if (key.startsWith("rated rookies signatures")) return true;
  if (rawKey.startsWith("rated rookies signatures")) return true;

  return false;
}

export function inferCardSetCategory(
  cardSetName: string,
  rawValue?: string
): string {
  const key = normalizeKey(cardSetName);
  if (BASE_SET_ROOTS.has(key)) return "Base Set";
  if (isSelectBaseTierCardSetName(cardSetName)) return "Base Set";
  if (key === "commons" || key === "prizms") return "Base Set";

  const rawKey = rawValue ? normalizeKey(normalizeSelectRawCardSetValue(rawValue)) : "";
  if (
    rawKey.startsWith("base ") &&
    !BASE_SET_ROOTS.has(key) &&
    !rawKey.replace(/^base\s+/, "").startsWith(`${key} `) &&
    normalizeKey(rawValue?.replace(/^base\s+/i, "") ?? "") !== key
  ) {
    return "Subset";
  }

  if (rawKey.startsWith("base ") && BASE_SET_ROOTS.has(key)) {
    return "Base Set";
  }

  if (isSignatureSubsetPattern(cardSetName, rawValue)) {
    return "Subset";
  }

  if (isOpticPreviewSubsetPattern(cardSetName, rawValue)) {
    return "Subset";
  }

  if (isRatedRookiesSubsetPattern(cardSetName, rawValue)) {
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
  const roots = findCardSetRoots(values);

  for (const value of values) {
    for (const root of roots) {
      if (value === root) continue;
      if (!value.startsWith(`${root} `)) continue;
      const suffix = value.slice(root.length + 1).trim();
      if (!suffix) continue;
      if (!suffixIndex.has(root)) suffixIndex.set(root, new Set());
      suffixIndex.get(root)!.add(suffix);
    }
  }

  for (const [root, suffixes] of suffixIndex) {
    for (const suffix of [...suffixes]) {
      for (const parentRoot of values) {
        if (parentRoot === root) continue;
        if (!root.startsWith(`${parentRoot} `)) continue;
        const intermediate = root.slice(parentRoot.length + 1).trim();
        if (!intermediate) continue;
        const compound = `${intermediate} ${suffix}`.trim();
        if (!suffixIndex.has(parentRoot)) suffixIndex.set(parentRoot, new Set());
        suffixIndex.get(parentRoot)!.add(compound);
      }
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
      if (trimmed.toLowerCase() === candidate.toLowerCase()) return false;
      if (!trimmed.startsWith(`${candidate} `)) return false;
      if (
        normalizeKey(candidate) === "base" &&
        trimmed.split(/\s+/).length > 2
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.trim().length - a.trim().length);

  const matches = extensionRoots
    .map((root) => ({
      root: root.trim(),
      parallel: trimmed.slice(root.trim().length + 1).trim(),
    }))
    .filter(
      (match) =>
        match.parallel && suffixIndex.get(match.root)?.has(match.parallel)
    )
    .sort((a, b) => b.root.length - a.root.length || b.parallel.length - a.parallel.length);

  if (matches[0]?.root) {
    return matches[0].root;
  }

  return extensionRoots[0]?.trim();
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

export function buildP0CardSetSplitCaches(
  distinctValues: string[]
): Dm2CardSetSplitCorrectionCaches {
  const values = [
    ...new Set(distinctValues.map((value) => value.trim()).filter(Boolean)),
  ];
  return {
    siblingIndex: buildSiblingParallelFamilySplitIndex(values),
    baseIndex: buildBasePrefixedSplitIndex(values),
    spectraIndex: buildSpectraCrossYearSplitIndex(values),
    crossProductIndex: buildCrossProductYearSplitIndex(values),
    spectraProductLineBaseIndex: buildSpectraProductLineBaseSplitIndex(values),
    selectPrizmsBaseIndex: buildSelectPrizmsBaseSplitIndex(values),
    baseSetDisplayName: resolveBaseCardSetDisplayName(values),
    usesSpectraCardSetRules: usesSpectraCardSetRules(values),
  };
}

export function buildCardSetSplitIndex(
  distinctValues: string[],
  caches?: Dm2CardSetSplitCorrectionCaches
): Map<
  string,
  { cardSetName: string; parallel?: string; cardSetCategory: string }
> {
  const values = [
    ...new Set(distinctValues.map((value) => value.trim()).filter(Boolean)),
  ];
  const splitCaches = caches ?? buildP0CardSetSplitCaches(values);
  const suffixIndex = buildParallelSuffixIndex(values);
  const index = new Map<
    string,
    { cardSetName: string; parallel?: string; cardSetCategory: string }
  >();

  for (const value of values) {
    const baseSplit = splitCaches.baseIndex?.get(value);
    const siblingSplit = splitCaches.siblingIndex?.get(value);
    const resolvedSplit = baseSplit ?? siblingSplit;

    if (resolvedSplit) {
      const corrected = applyP0CardSetSplitCorrections(
        {
          cardSetName: resolvedSplit.cardSetName,
          parallel: resolvedSplit.parallel ?? null,
          cardSetCategory: baseSplit
            ? baseSplit.cardSetCategory
            : inferCardSetCategory(resolvedSplit.cardSetName, value),
        },
        value,
        values,
        splitCaches
      );
      index.set(value, {
        cardSetName: corrected.cardSetName,
        parallel: corrected.parallel ?? undefined,
        cardSetCategory: corrected.cardSetCategory ?? "Insert",
      });
      continue;
    }

    const split = splitCombinedCardSetValue(value, values, suffixIndex);
    const corrected = applyP0CardSetSplitCorrections(
      {
        cardSetName: split.cardSetName,
        parallel: split.parallel ?? null,
        cardSetCategory: inferCardSetCategory(split.cardSetName, value),
      },
      value,
      values,
      splitCaches
    );
    index.set(value, {
      cardSetName: corrected.cardSetName,
      parallel: corrected.parallel ?? undefined,
      cardSetCategory: corrected.cardSetCategory ?? "Insert",
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
