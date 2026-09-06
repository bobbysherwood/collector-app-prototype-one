import type { GraderPopCandidate } from "@/lib/card-population-lookup/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function asCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d[\d,]*$/.test(value.trim())) {
    return Number(value.replace(/,/g, ""));
  }
  return null;
}

function collectRows(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  const root = asRecord(json);
  if (!root) return [];
  for (const key of ["data", "items", "results", "Rows", "rows", "setItems"]) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
  const nested = asRecord(root.data);
  if (nested) {
    for (const key of ["items", "results", "Rows", "rows"]) {
      if (Array.isArray(nested[key])) return nested[key] as unknown[];
    }
  }
  return [];
}

function readGradeCounts(row: Record<string, unknown>): Record<string, number | null> {
  const counts: Record<string, number | null> = {};
  const nested = asRecord(row.grades) ?? asRecord(row.Grades) ?? asRecord(row.population);
  const source = nested ?? row;

  for (let grade = 1; grade <= 10; grade += 1) {
    const keys = [
      `Grade${grade}`,
      `grade${grade}`,
      `psa_${grade}`,
      `PSA${grade}`,
      String(grade),
    ];
    let value: number | null = null;
    for (const key of keys) {
      value = asCount(source[key]);
      if (value != null) break;
    }
    counts[`psa_${grade}`] = value;
  }
  return counts;
}

function isNoiseRow(row: Record<string, unknown>, cardNumber: string, subject: string): boolean {
  const label = `${asString(row.RowType)} ${asString(row.rowType)} ${subject}`.toLowerCase();
  if (label.includes("total population") || label === "+" || label === "q") return true;
  if (label === "grade" && !cardNumber) return true;
  if (!cardNumber && !subject) return true;
  return false;
}

function splitSubjectAndVariety(subject: string, variety: string): {
  subject: string;
  variety: string;
} {
  if (variety) return { subject, variety };
  return { subject, variety: "Base" };
}

export function parsePsaPopulationJson(
  json: unknown,
  setName = "Unknown set"
): GraderPopCandidate[] {
  const year = Number(setName.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? NaN);
  return collectRows(json).flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const cardNumber = asString(
      row.CardNumber ?? row.cardNumber ?? row.CardNo ?? row.card_no ?? row.SpecNumber
    );
    const rawName = asString(row.Subject ?? row.subject ?? row.Name ?? row.name ?? row.Player);
    const variety = asString(
      row.Variety ?? row.variety ?? row.Parallel ?? row.parallel ?? row.Variation
    );
    if (isNoiseRow(row, cardNumber, rawName)) return [];
    if (!cardNumber || !rawName) return [];

    const split = splitSubjectAndVariety(rawName, variety);
    const counts = readGradeCounts(row);
    const hasCount = Object.values(counts).some((value) => value != null);
    if (!hasCount) return [];

    return [
      {
        grader: "PSA" as const,
        setName,
        year: Number.isFinite(year) ? year : null,
        cardNumber,
        subject: split.subject,
        variety: split.variety,
        counts,
      },
    ];
  });
}

export function applyPlayerPrefixVariety(
  candidate: GraderPopCandidate,
  playerName: string
): GraderPopCandidate {
  const player = playerName.trim();
  if (!player || candidate.variety !== "Base") return candidate;
  const pattern = new RegExp(`^${player.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(.+)$`, "i");
  const match = candidate.subject.match(pattern);
  if (!match) return candidate;
  return {
    ...candidate,
    subject: player,
    variety: match[1].trim(),
  };
}
