import type { Dm2CardSearchResult } from "@/types/data-model-v2";

export const CARD_POPULATION_ADMIN_TITLE = "Card Population";

export const CARD_POPULATION_IDENTITY_FIELDS = [
  "Player",
  "Card #",
  "Sport",
  "Year",
  "Manufacturer",
  "Brand",
  "Card Set",
  "Card Set Category",
  "Parallel",
  "Unique Card ID",
] as const;

export type CardPopulationGrader = "PSA" | "BGS" | "SGC" | "CGC";

export interface CardPopulationField {
  key: string;
  grader: CardPopulationGrader;
  grade: string;
}

export type CardPopulationCounts = Record<string, number | null>;

export type PopulationRecordStatus = "Exists" | "Not Created";

const WHOLE_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function fieldKey(grader: CardPopulationGrader, grade: string): string {
  return `${grader.toLowerCase()}_${grade.replace(".", "_")}`;
}

function fieldsForGrader(grader: CardPopulationGrader): CardPopulationField[] {
  const grades =
    grader === "PSA"
      ? WHOLE_GRADES.map(String)
      : [...WHOLE_GRADES.slice(0, 9).map(String), "9.5", "10"];
  return grades.map((grade) => ({
    key: fieldKey(grader, grade),
    grader,
    grade,
  }));
}

export const CARD_POPULATION_GRADERS: CardPopulationGrader[] = [
  "PSA",
  "BGS",
  "SGC",
  "CGC",
];

export const CARD_POPULATION_FIELDS: CardPopulationField[] =
  CARD_POPULATION_GRADERS.flatMap(fieldsForGrader);

export const CARD_POPULATION_KEYS = CARD_POPULATION_FIELDS.map((field) => field.key);

export function emptyPopulationCounts(): CardPopulationCounts {
  return Object.fromEntries(CARD_POPULATION_KEYS.map((key) => [key, null]));
}

export function populationRecordStatus(exists: boolean): PopulationRecordStatus {
  return exists ? "Exists" : "Not Created";
}

export const CARD_POPULATION_SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "the",
  "to",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCardUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function cardSearchHaystack(card: Dm2CardSearchResult): string {
  return [
    card.player,
    String(card.year),
    card.manufacturerName,
    card.brandName,
    card.cardSetName,
    card.cardSetCategoryName,
    card.parallelName ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function matchesCardPopulationSearch(
  card: Dm2CardSearchResult,
  query: string
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const tokens = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !CARD_POPULATION_SEARCH_STOP_WORDS.has(token));
  if (tokens.length === 0) return false;

  const haystack = cardSearchHaystack(card);
  return tokens.every((token) => haystack.includes(token));
}

export function parsePopulationInput(
  raw: string | number | null | undefined
): { value: number | null } | { error: string } {
  if (raw == null) return { value: null };
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 0) {
      return { error: "Population counts must be whole numbers of zero or more." };
    }
    return { value: raw };
  }

  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };

  const normalized = trimmed.replace(/,/g, "");
  if (!/^\d+$/.test(normalized)) {
    return {
      error:
        "Population counts must be whole numbers. Leave a field blank if the count is unknown.",
    };
  }

  const value = Number(normalized);
  if (!Number.isSafeInteger(value)) {
    return { error: "Population count is too large." };
  }
  return { value };
}

export function parsePopulationForm(
  form: Record<string, string | number | null | undefined>
): { counts: CardPopulationCounts; error?: string } {
  const counts = emptyPopulationCounts();

  for (const key of CARD_POPULATION_KEYS) {
    const parsed = parsePopulationInput(form[key]);
    if ("error" in parsed) {
      return { counts, error: `${key.toUpperCase().replaceAll("_", " ")}: ${parsed.error}` };
    }
    counts[key] = parsed.value;
  }

  return { counts };
}

export function applyPopulationPatch(
  existing: CardPopulationCounts | null,
  patch: Partial<CardPopulationCounts>
): CardPopulationCounts {
  const next = existing ? { ...emptyPopulationCounts(), ...existing } : emptyPopulationCounts();
  for (const key of CARD_POPULATION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = patch[key] ?? null;
    }
  }
  return next;
}

export function countsToFormValues(counts: CardPopulationCounts): Record<string, string> {
  return Object.fromEntries(
    CARD_POPULATION_KEYS.map((key) => [
      key,
      counts[key] == null ? "" : String(counts[key]),
    ])
  );
}

export function formatPopulationCount(value: number | null | undefined): string {
  if (value == null) return "";
  return value.toLocaleString("en-US");
}

export function rowToPopulationCounts(
  row: Record<string, number | null | undefined> | null | undefined
): CardPopulationCounts {
  const counts = emptyPopulationCounts();
  if (!row) return counts;
  for (const key of CARD_POPULATION_KEYS) {
    const value = row[key];
    counts[key] = typeof value === "number" ? value : null;
  }
  return counts;
}

export function fieldsByGrader(): Record<CardPopulationGrader, CardPopulationField[]> {
  return {
    PSA: CARD_POPULATION_FIELDS.filter((field) => field.grader === "PSA"),
    BGS: CARD_POPULATION_FIELDS.filter((field) => field.grader === "BGS"),
    SGC: CARD_POPULATION_FIELDS.filter((field) => field.grader === "SGC"),
    CGC: CARD_POPULATION_FIELDS.filter((field) => field.grader === "CGC"),
  };
}
