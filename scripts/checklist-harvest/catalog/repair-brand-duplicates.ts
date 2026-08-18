import type { ChecklistCatalog, ChecklistCatalogEntry } from "./types";

/** Playoff brand should only list Contenders-family programs on Panini's site. */
function isPlayoffOnlyProgram(setLabel: string): boolean {
  return /contenders/i.test(setLabel);
}

function entryKey(entry: Pick<ChecklistCatalogEntry, "year" | "set_label">): string {
  return `${entry.year}|${entry.set_label}`;
}

export interface RepairBrandDuplicatesResult {
  deprecatedIds: string[];
  skippedIds: string[];
}

/**
 * Deprecate misclassified Playoff catalog entries when the same year/program
 * already exists under the correct brand (typically Panini).
 */
export function repairBrandDuplicates(catalog: ChecklistCatalog): RepairBrandDuplicatesResult {
  const byKey = new Map<string, ChecklistCatalogEntry[]>();
  for (const entry of catalog.entries) {
    const key = entryKey(entry);
    const list = byKey.get(key) ?? [];
    list.push(entry);
    byKey.set(key, list);
  }

  const deprecatedIds: string[] = [];
  const skippedIds: string[] = [];

  for (const entry of catalog.entries) {
    if (entry.status === "deprecated") continue;
    if (entry.brand !== "Playoff") continue;
    if (isPlayoffOnlyProgram(entry.set_label)) continue;

    const siblings = byKey.get(entryKey(entry)) ?? [];
    const canonical = siblings.find(
      (s) => s.id !== entry.id && s.brand !== "Playoff" && s.status !== "deprecated"
    );

    if (!canonical) {
      skippedIds.push(entry.id);
      continue;
    }

    entry.status = "deprecated";
    entry.error = `Deprecated duplicate of ${canonical.id} (misassigned Playoff brand)`;
    deprecatedIds.push(entry.id);
  }

  catalog.last_discovered_at = new Date().toISOString();
  return { deprecatedIds, skippedIds };
}
