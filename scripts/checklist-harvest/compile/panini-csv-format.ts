import type { ChecklistCatalogEntry } from "../catalog/types";
import { PANINI_CHECKLIST } from "../config/panini-basketball";

export const PANINI_METADATA_COLUMNS = ["Sport", "Year", "Brand", "Program"] as const;

export const PANINI_CARD_COLUMNS = [
  "CARD SET",
  "CARD #",
  "ATHLETE",
  "TEAM",
  "POSITION",
] as const;

export const PANINI_CHECKLIST_CSV_COLUMNS = [
  ...PANINI_METADATA_COLUMNS,
  ...PANINI_CARD_COLUMNS,
] as const;

export type PaniniChecklistMetadata = Record<(typeof PANINI_METADATA_COLUMNS)[number], string>;

export function resolveChecklistMetadata(
  entry: Pick<ChecklistCatalogEntry, "year" | "brand" | "set_label" | "discovery_meta">
): PaniniChecklistMetadata {
  return {
    Sport: entry.discovery_meta?.sport_label ?? PANINI_CHECKLIST.sport,
    Year: entry.discovery_meta?.year_label ?? entry.year,
    Brand: entry.discovery_meta?.brand_label ?? entry.brand,
    Program: entry.discovery_meta?.set_label ?? entry.set_label,
  };
}

export function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function formatPaniniChecklistRow(
  metadata: PaniniChecklistMetadata,
  card: {
    cardSet: string;
    cardNo: string;
    athlete: string;
    team: string;
    position: string;
  }
): string {
  return [
    metadata.Sport,
    metadata.Year,
    metadata.Brand,
    metadata.Program,
    card.cardSet,
    card.cardNo,
    card.athlete,
    card.team,
    card.position,
  ]
    .map(csvCell)
    .join(",");
}

export function paniniChecklistCsvHeader(): string {
  return PANINI_CHECKLIST_CSV_COLUMNS.join(",");
}
