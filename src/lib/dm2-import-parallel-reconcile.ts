import { findCardSetRoots, isCrossProductYearCombinedValue, isSpectraCrossYearCombinedValue, normalizeCardSetRootName, countCardSetPrefixFamilyMembers } from "@/lib/dm2-import-spreadsheet-split";
import type { Dm2ExtractedRow, Dm2ImportCatalogContext } from "@/types/dm2-import";

type CardSetValueSplit = {
  cardSetName: string;
  parallel: string | null;
  cardSetCategory: string | null;
};

const CARD_SET_NAME_EXCLUSIVE_TOKENS = new Set([
  "signature",
  "signatures",
  "signograph",
  "signings",
  "signing",
  "autograph",
  "autographs",
  "calligraphy",
]);

const CARD_SET_NAME_EXCLUSIVE_PHRASES = [
  "private signings",
  "calligraphy signatures",
];

export function isCardSetNameExclusiveToken(word: string): boolean {
  return CARD_SET_NAME_EXCLUSIVE_TOKENS.has(word.trim().toLowerCase());
}

/** True when parallel contains set-name-only vocabulary (Signature, Autograph, etc.). */
export function parallelContainsCardSetNameExclusiveToken(parallel: string): boolean {
  const trimmed = parallel.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (CARD_SET_NAME_EXCLUSIVE_PHRASES.some((phrase) => lower.includes(phrase))) {
    return true;
  }

  return trimmed.split(/\s+/).some(isCardSetNameExclusiveToken);
}

/** CARD SET values that must stay unsplit (e.g. program titles with " - Signatures"). */
export function shouldPreserveAtomicCardSetValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (trimmed.toLowerCase().startsWith("base set - ")) return false;

  if (isSpectraCrossYearCombinedValue(trimmed)) return false;

  if (isCrossProductYearCombinedValue(trimmed)) return false;

  const dashIndex = trimmed.indexOf(" - ");
  if (dashIndex < 0) return false;

  const afterDash = trimmed.slice(dashIndex + 3).trim();
  if (!afterDash) return false;

  return parallelContainsCardSetNameExclusiveToken(afterDash);
}

/** Parallel suffixes that are different insert titles, not color/ finish variants. */
export function parallelSuffixesContainExclusiveInsertTokens(
  suffixes: string[]
): boolean {
  return suffixes.some((suffix) => parallelContainsCardSetNameExclusiveToken(suffix));
}

export function filterCardSetNameExclusiveParallelCandidates(
  candidates: string[]
): string[] {
  return candidates.filter(
    (candidate) => !parallelContainsCardSetNameExclusiveToken(candidate)
  );
}

/** Parallel phrases where Autographs/Signatures are part of the parallel name, not split into cardSetName. */
const COMPOUND_EXCLUSIVE_PARALLEL_PHRASES = [
  "premium box set autographs",
];

function isCompoundExclusiveParallelPhrase(parallel: string): boolean {
  const key = parallel.trim().toLowerCase();
  return COMPOUND_EXCLUSIVE_PARALLEL_PHRASES.some((phrase) => key === phrase);
}

/** Move Signature/Autograph vocabulary from parallel into cardSetName. */
export function reconcileCardSetNameExclusiveParallelSplit<
  T extends {
    cardSetName: string;
    parallel: string | null;
    cardSetCategory?: string | null;
  },
>(split: T): T {
  const parallel = split.parallel?.trim();
  if (!parallel || !parallelContainsCardSetNameExclusiveToken(parallel)) {
    return reconcileExclusiveTokenTrailingParallelInSetName(split);
  }

  if (isCompoundExclusiveParallelPhrase(parallel)) {
    return reconcileExclusiveTokenTrailingParallelInSetName(split);
  }

  const tokens = parallel.split(/\s+/).filter(Boolean);
  const setNameTokens = tokens.filter(isCardSetNameExclusiveToken);
  const parallelTokens = tokens.filter((token) => !isCardSetNameExclusiveToken(token));

  const cardSetName = [split.cardSetName.trim(), ...setNameTokens]
    .filter(Boolean)
    .join(" ")
    .trim();

  const nextParallel = parallelTokens.join(" ").trim() || null;

  return reconcileExclusiveTokenTrailingParallelInSetName({
    ...split,
    cardSetName,
    parallel: nextParallel,
  });
}

function lastExclusiveTokenIndex(nameWords: string[]): number {
  let lastIndex = -1;
  for (let index = 0; index < nameWords.length; index++) {
    if (isCardSetNameExclusiveToken(nameWords[index])) {
      lastIndex = index;
    }
  }
  return lastIndex;
}

function isParallelModifierStem(modifier: string): boolean {
  const words = tokenizeWords(modifier);
  if (words.length === 0) return false;
  if (words[0].toLowerCase() === "choice") return true;
  const PARALLEL_STEM_WORDS = new Set([
    "aqua", "black", "blue", "gold", "green", "holo", "hyper", "neon",
    "orange", "pink", "purple", "red", "velocity", "white",
  ]);
  return words.length === 1 && PARALLEL_STEM_WORDS.has(words[0].toLowerCase());
}

/**
 * When cardSetName ends with Signatures/Autographs plus trailing parallel words
 * (e.g. "Dominators Signatures Gold"), move the trailing words into parallel.
 */
export function reconcileExclusiveTokenTrailingParallelInSetName<
  T extends {
    cardSetName: string;
    parallel: string | null;
    cardSetCategory?: string | null;
  },
>(split: T): T {
  const cardSetName = split.cardSetName?.trim() ?? "";
  if (!cardSetName) return split;

  const nameWords = tokenizeWords(cardSetName);
  const exclusiveIndex = lastExclusiveTokenIndex(nameWords);
  if (exclusiveIndex < 0 || exclusiveIndex >= nameWords.length - 1) {
    return split;
  }

  const baseSetName = nameWords.slice(0, exclusiveIndex + 1).join(" ").trim();
  const trailingParallel = nameWords.slice(exclusiveIndex + 1).join(" ").trim();
  if (!baseSetName || !trailingParallel) return split;
  if (!isParallelModifierStem(trailingParallel.split(/\s+/)[0] ?? "")) {
    return split;
  }

  const existingParallel = split.parallel?.trim() ?? "";
  const nextParallel = existingParallel
    ? `${trailingParallel} ${existingParallel}`.trim()
    : trailingParallel;

  return {
    ...split,
    cardSetName: normalizeCardSetRootName(baseSetName),
    parallel: nextParallel,
  };
}

function tokenizeWords(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

/** Shorten cardSetName when it repeats words already present in parallel. */
export function reconcileOverlappingSetNameParallelWords<
  T extends {
    cardSetName: string;
    parallel: string | null;
    cardSetCategory?: string | null;
  },
>(split: T): T {
  const cardSetName = split.cardSetName?.trim() ?? "";
  const parallel = split.parallel?.trim() ?? "";
  if (!cardSetName || !parallel) return split;

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

  if (overlapIndex === nameWords.length) return split;

  const moveWords = nameWords.slice(overlapIndex);
  const nextName = nameWords.slice(0, overlapIndex).join(" ").trim();
  if (!nextName) return split;

  const moveText = moveWords.join(" ");
  let nextParallel = parallel;
  if (!parallel.toLowerCase().startsWith(moveText.toLowerCase())) {
    nextParallel = `${moveText} ${parallel}`.trim();
  }

  return {
    ...split,
    cardSetName: normalizeCardSetRootName(nextName),
    parallel: nextParallel,
  };
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function canonicalParallelName(
  name: string,
  parallelByKey: Map<string, string>
): string {
  return parallelByKey.get(normalizeKey(name)) ?? name.trim();
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

/** Catalog parallels plus compounds inferred from sibling CARD SET values (longest first). */
export function buildExtendedParallelCandidates(
  catalogParallels: string[],
  distinctValues: string[]
): string[] {
  const byKey = buildCatalogParallelKeyMap(catalogParallels);
  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || parallelContainsCardSetNameExclusiveToken(trimmed)) return;
    if (!byKey.has(normalizeKey(trimmed))) {
      byKey.set(normalizeKey(trimmed), trimmed);
    }
  };

  const values = [
    ...new Set(distinctValues.map((value) => value.trim()).filter(Boolean)),
  ];

  for (const value of values) {
    for (const root of values) {
      if (value === root) continue;
      const rootKey = normalizeKey(root);
      const valueKey = normalizeKey(value);
      if (!valueKey.startsWith(`${rootKey} `)) continue;
      add(value.slice(root.length).trim());
    }
  }

  const catalogList = [...byKey.values()];
  for (const root of findCardSetRoots(values)) {
    const members = values.filter(
      (value) =>
        normalizeKey(value) === normalizeKey(root) ||
        normalizeKey(value).startsWith(`${normalizeKey(root)} `)
    );
    const suffixes = members
      .map((member) =>
        normalizeKey(member) === normalizeKey(root)
          ? ""
          : member.slice(root.length).trim()
      )
      .filter(Boolean);

    for (const suffix of suffixes) {
      add(suffix);
    }

    for (const prefix of catalogList) {
      const prefixKey = normalizeKey(prefix);
      for (const suffix of suffixes) {
        const suffixKey = normalizeKey(suffix);
        if (suffixKey.startsWith(`${prefixKey} `)) {
          add(suffix);
        } else if (suffixKey === prefixKey) {
          for (const secondary of catalogList) {
            const secondaryKey = normalizeKey(secondary);
            if (secondaryKey === prefixKey) continue;
            add(`${prefix} ${secondary}`);
          }
        }
      }
    }
  }

  return [...byKey.values()].sort((a, b) => b.length - a.length);
}

/** True when a catalog parallel token is part of the insert name, not a peelable suffix. */
function isParallelPrefixEmbeddedInCardSetName(
  cardSetName: string,
  parallelPrefix: string
): boolean {
  const trimmed = cardSetName.trim();
  const nameKey = normalizeKey(trimmed);
  const prefixKey = normalizeKey(parallelPrefix);

  if (nameKey === "elite gold" && prefixKey === "gold") return true;
  if (nameKey === "prizms" && prefixKey.startsWith("prizms")) return true;
  if (nameKey === "commons") return true;
  if (nameKey === "white hot rookies" || nameKey === "white hot stars") return true;
  if (
    nameKey === "rookie autographs" ||
    nameKey === "rookie jersey autographs" ||
    nameKey === "select stars jersey autographs"
  ) {
    return true;
  }
  if (/^production line\s-/i.test(trimmed)) {
    if (new Set(["scoring", "assists", "rebounds"]).has(prefixKey)) return true;
  }

  return false;
}

/** Merge cardSetName ending with one parallel and a fragment parallel (e.g. Fast Break + Pink). */
export function mergeFragmentedParallelSplit(
  split: CardSetValueSplit,
  parallelCandidates: string[]
): CardSetValueSplit {
  const parallel = split.parallel?.trim();
  const cardSetName = split.cardSetName?.trim();
  if (!parallel || !cardSetName) return split;

  const parallelByKey = buildCatalogParallelKeyMap(parallelCandidates);
  if (!parallelByKey.has(normalizeKey(parallel))) return split;

  const sortedPrefixes = [...parallelByKey.values()].sort(
    (a, b) => b.length - a.length
  );
  const nameKey = normalizeKey(cardSetName);
  const parallelKey = normalizeKey(parallel);

  for (const prefix of sortedPrefixes) {
    const prefixKey = normalizeKey(prefix);
    if (prefixKey === parallelKey) continue;
    if (
      parallelKey.startsWith(`${prefixKey} `) ||
      parallelKey.endsWith(` ${prefixKey}`)
    ) {
      continue;
    }
    if (nameKey !== prefixKey && !nameKey.endsWith(` ${prefixKey}`)) continue;
    if (isParallelPrefixEmbeddedInCardSetName(cardSetName, prefix)) continue;

    const compound = `${prefix} ${parallel}`.trim();
    const nextName =
      nameKey === prefixKey
        ? ""
        : cardSetName.slice(0, cardSetName.length - prefix.length).trim();
    if (!nextName) continue;

    return {
      ...split,
      cardSetName: nextName,
      parallel: canonicalParallelName(compound, parallelByKey),
    };
  }

  return split;
}

export function resolveBestParallelSuffix(
  rawValue: string,
  parallelCandidates: string[]
): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const rawLower = trimmed.toLowerCase();
  let bestMatch: string | null = null;

  for (const parallel of parallelCandidates) {
    const parallelLower = parallel.toLowerCase();
    if (!rawLower.endsWith(parallelLower)) continue;
    if (rawLower.length <= parallelLower.length) continue;

    const boundaryIndex = trimmed.length - parallel.length;
    if (boundaryIndex > 0 && trimmed[boundaryIndex - 1] !== " ") continue;

    if (
      !bestMatch ||
      parallel.length > bestMatch.length ||
      (parallel.length === bestMatch.length &&
        parallelCandidates.indexOf(parallel) <
          parallelCandidates.indexOf(bestMatch))
    ) {
      bestMatch = parallel;
    }
  }

  return bestMatch;
}

export function correctCardSetValueSplit(
  split: CardSetValueSplit,
  rawValue: string,
  parallelCandidates: string[],
  distinctValues?: string[]
): CardSetValueSplit {
  const merged = mergeFragmentedParallelSplit(split, parallelCandidates);
  if (
    merged.parallel !== split.parallel ||
    merged.cardSetName !== split.cardSetName
  ) {
    return reconcileOverlappingSetNameParallelWords(
      reconcileCardSetNameExclusiveParallelSplit(merged)
    );
  }

  const trimmedRaw = rawValue.trim();
  if (!trimmedRaw) {
    return reconcileOverlappingSetNameParallelWords(
      reconcileCardSetNameExclusiveParallelSplit(split)
    );
  }

  const bestParallel = resolveBestParallelSuffix(trimmedRaw, parallelCandidates);
  if (!bestParallel) {
    return reconcileOverlappingSetNameParallelWords(
      reconcileCardSetNameExclusiveParallelSplit(split)
    );
  }

  const prefix = trimmedRaw
    .slice(0, trimmedRaw.length - bestParallel.length)
    .trim();
  if (!prefix) {
    return reconcileOverlappingSetNameParallelWords(
      reconcileCardSetNameExclusiveParallelSplit(split)
    );
  }

  if (
    distinctValues &&
    prefix.split(/\s+/).filter(Boolean).length === 1 &&
    countCardSetPrefixFamilyMembers(prefix, distinctValues) < 2
  ) {
    return reconcileOverlappingSetNameParallelWords(
      reconcileCardSetNameExclusiveParallelSplit(split)
    );
  }

  const nameKey = split.cardSetName.trim().toLowerCase();
  const prefixKey = prefix.toLowerCase();
  const parallelKey = (split.parallel ?? "").trim().toLowerCase();
  const bestKey = bestParallel.toLowerCase();

  const nameMatchesRaw =
    nameKey === trimmedRaw.toLowerCase() ||
    nameKey === prefixKey ||
    nameKey.endsWith(` ${bestKey}`);

  if (!nameMatchesRaw && split.parallel) {
    return reconcileOverlappingSetNameParallelWords(
      reconcileCardSetNameExclusiveParallelSplit(split)
    );
  }

  if (split.parallel && parallelKey === bestKey) {
    return reconcileOverlappingSetNameParallelWords(
      reconcileCardSetNameExclusiveParallelSplit(split)
    );
  }

  if (
    split.parallel &&
    parallelKey !== bestKey &&
    !mergeFragmentedParallelSplit(split, parallelCandidates).parallel?.includes(
      bestParallel
    )
  ) {
    const fragmented = mergeFragmentedParallelSplit(split, parallelCandidates);
    if (fragmented.parallel !== split.parallel) {
      return reconcileOverlappingSetNameParallelWords(
        reconcileCardSetNameExclusiveParallelSplit(fragmented)
      );
    }
  }

  return reconcileOverlappingSetNameParallelWords(
    reconcileCardSetNameExclusiveParallelSplit({
      ...split,
      cardSetName:
        nameKey === prefixKey || nameKey.endsWith(` ${bestKey}`)
          ? prefix
          : split.cardSetName,
      parallel: bestParallel,
    })
  );
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

  const extendedParallels = buildExtendedParallelCandidates(
    catalogParallels,
    [rawValue]
  );

  for (const parallel of extendedParallels) {
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

/** Insert names where a trailing color/stat token is part of the set name, not a parallel suffix. */
function shouldPeelParallelSuffixFromCardSetName(
  cardSetName: string,
  rowParallel: string | undefined
): boolean {
  const trimmed = cardSetName.trim();
  const nameKey = normalizeKey(trimmed);
  if (!trimmed) return false;

  if (nameKey === "elite gold") return false;
  if (nameKey === "prizms" || nameKey === "commons") return false;
  if (
    nameKey === "white hot rookies" ||
    nameKey === "white hot stars" ||
    nameKey === "rookie autographs" ||
    nameKey === "rookie jersey autographs" ||
    nameKey === "select stars jersey autographs"
  ) {
    return false;
  }
  if (/^production line\s-/i.test(trimmed)) return false;
  if (rowParallel?.trim()) return false;

  return true;
}

function reconcileRowEndingParallelFragment(
  row: Dm2ExtractedRow,
  parallelByKey: Map<string, string>,
  sortedParallels: string[],
  protectedCardSetNameKeys?: Set<string>
): Dm2ExtractedRow {
  const cardSetName = row.cardSetName?.trim();
  if (!cardSetName) return row;

  const nameKey = normalizeKey(cardSetName);
  if (protectedCardSetNameKeys?.has(nameKey)) return row;
  const merged = mergeFragmentedParallelSplit(
    {
      cardSetName,
      parallel: row.parallel ?? null,
      cardSetCategory: row.cardSetCategory ?? null,
    },
    sortedParallels
  );

  if (
    merged.cardSetName !== cardSetName ||
    merged.parallel !== (row.parallel ?? null)
  ) {
    return {
      ...row,
      cardSetName: merged.cardSetName,
      parallel: merged.parallel ?? undefined,
    };
  }

  if (!shouldPeelParallelSuffixFromCardSetName(cardSetName, row.parallel)) {
    return row;
  }

  for (const parallelName of sortedParallels) {
    const parallelKey = normalizeKey(parallelName);
    if (nameKey !== parallelKey && !nameKey.endsWith(` ${parallelKey}`)) {
      continue;
    }
    if (isParallelPrefixEmbeddedInCardSetName(cardSetName, parallelName)) {
      continue;
    }

    const nextName =
      nameKey === parallelKey
        ? ""
        : cardSetName.slice(0, cardSetName.length - parallelName.length).trim();

    const nextParallel = resolveCompoundParallel(
      parallelName,
      row.parallel,
      parallelByKey
    );

    if (nameKey === parallelKey) {
      return {
        ...row,
        cardSetName: "Base Set",
        parallel: nextParallel,
        cardSetCategory: row.cardSetCategory ?? "Base Set",
      };
    }

    if (nextName) {
      return {
        ...row,
        cardSetName: nextName,
        parallel: nextParallel,
      };
    }
  }

  return row;
}

function compositeCardSetName(row: Dm2ExtractedRow): string | null {
  const cardSetName = row.cardSetName?.trim();
  if (!cardSetName) return null;
  const parallel = row.parallel?.trim();
  return parallel ? `${cardSetName} ${parallel}`.trim() : cardSetName;
}

function isProtectedCardSetRow(
  row: Dm2ExtractedRow,
  protectedCardSetNameKeys?: Set<string>
): boolean {
  if (!protectedCardSetNameKeys?.size) return false;

  const cardSetName = row.cardSetName?.trim();
  if (cardSetName && protectedCardSetNameKeys.has(normalizeKey(cardSetName))) {
    return true;
  }

  const composite = compositeCardSetName(row);
  return composite != null && protectedCardSetNameKeys.has(normalizeKey(composite));
}

function reconcileCardSetNameExclusiveOnExtractedRow(
  row: Dm2ExtractedRow,
  protectedCardSetNameKeys?: Set<string>
): Dm2ExtractedRow {
  if (row.excluded || !row.parallel?.trim()) return row;
  if (isProtectedCardSetRow(row, protectedCardSetNameKeys)) return row;

  const split = reconcileOverlappingSetNameParallelWords(
    reconcileCardSetNameExclusiveParallelSplit({
      cardSetName: row.cardSetName?.trim() ?? "",
      parallel: row.parallel ?? null,
      cardSetCategory: row.cardSetCategory ?? null,
    })
  );

  if (
    split.cardSetName === (row.cardSetName?.trim() ?? "") &&
    split.parallel === (row.parallel?.trim() ?? null)
  ) {
    return row;
  }

  return {
    ...row,
    cardSetName: split.cardSetName || row.cardSetName,
    parallel: split.parallel ?? undefined,
  };
}

/** Move known catalog parallel names out of cardSetName on extracted rows. */
export function reconcileExtractedRowsWithCatalogParallels(
  rows: Dm2ExtractedRow[],
  catalog: Dm2ImportCatalogContext,
  protectedCardSetNameKeys?: Set<string>
): Dm2ExtractedRow[] {
  const parallelByKey = new Map(
    catalog.parallels
      .filter((parallel) => !parallelContainsCardSetNameExclusiveToken(parallel.name))
      .map((parallel) => [normalizeKey(parallel.name), parallel.name])
  );
  const setNameKeys = new Set(
    catalog.cardSetNames.map((setName) => normalizeKey(setName.name))
  );
  const sortedParallels = [...parallelByKey.values()].sort(
    (a, b) => b.length - a.length
  );

  if (parallelByKey.size === 0) {
    return rows.map((row) =>
      reconcileCardSetNameExclusiveOnExtractedRow(row, protectedCardSetNameKeys)
    );
  }

  return rows.map((row) => {
    if (row.excluded || !row.cardSetName?.trim()) {
      return reconcileCardSetNameExclusiveOnExtractedRow(
        row,
        protectedCardSetNameKeys
      );
    }

    const setKey = normalizeKey(row.cardSetName);
    if (setNameKeys.has(setKey)) {
      return reconcileCardSetNameExclusiveOnExtractedRow(
        row,
        protectedCardSetNameKeys
      );
    }

    const parallelName = parallelByKey.get(setKey);
    if (parallelName) {
      const nextParallel = resolveCompoundParallel(
        parallelName,
        row.parallel,
        parallelByKey
      );

      return reconcileCardSetNameExclusiveOnExtractedRow(
        {
          ...row,
          cardSetName: "Base Set",
          parallel: nextParallel,
          cardSetCategory: "Base Set",
        },
        protectedCardSetNameKeys
      );
    }

    return reconcileCardSetNameExclusiveOnExtractedRow(
      reconcileRowEndingParallelFragment(
        row,
        parallelByKey,
        sortedParallels,
        protectedCardSetNameKeys
      ),
      protectedCardSetNameKeys
    );
  });
}

export function parallelTokenAppearsInBothNameAndParallel(
  cardSetName: string | undefined,
  parallel: string | undefined,
  catalogParallels: string[]
): boolean {
  const name = cardSetName?.trim();
  const par = parallel?.trim();
  if (!name || !par) return false;

  const nameKey = normalizeKey(name);
  const parallelKey = normalizeKey(par);

  for (const candidate of catalogParallels) {
    const candidateKey = normalizeKey(candidate);
    if (!candidateKey || candidateKey === parallelKey) continue;
    if (
      (nameKey === candidateKey || nameKey.endsWith(` ${candidateKey}`)) &&
      (parallelKey === candidateKey ||
        parallelKey.startsWith(`${candidateKey} `) ||
        parallelKey.endsWith(` ${candidateKey}`))
    ) {
      return true;
    }
  }

  for (const prefix of catalogParallels) {
    const prefixKey = normalizeKey(prefix);
    if (prefixKey === parallelKey) continue;
    if (
      (nameKey === prefixKey || nameKey.endsWith(` ${prefixKey}`)) &&
      parallelKey !== prefixKey &&
      !parallelKey.startsWith(`${prefixKey} `)
    ) {
      return true;
    }
  }

  return false;
}
