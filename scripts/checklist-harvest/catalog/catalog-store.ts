import { PANINI_CHECKLIST } from "../config/panini-basketball";
import type { ChecklistCatalog, ChecklistCatalogEntry } from "./types";
import { CATALOG_PATH } from "./types";
import type { StorageAdapter } from "../storage/types";

export async function loadCatalog(storage: StorageAdapter): Promise<ChecklistCatalog | null> {
  if (!(await storage.exists(CATALOG_PATH))) return null;
  const text = await storage.readText(CATALOG_PATH);
  return JSON.parse(text) as ChecklistCatalog;
}

export async function saveCatalog(storage: StorageAdapter, catalog: ChecklistCatalog): Promise<void> {
  await storage.write(CATALOG_PATH, JSON.stringify(catalog, null, 2));
}

export function mergeCatalogEntries(
  existing: ChecklistCatalogEntry[],
  discovered: ChecklistCatalogEntry[]
): { entries: ChecklistCatalogEntry[]; newCount: number; deprecatedCount: number } {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const discoveredIds = new Set(discovered.map((e) => e.id));
  let newCount = 0;

  for (const entry of discovered) {
    const prev = byId.get(entry.id);
    if (prev) {
      byId.set(entry.id, {
        ...prev,
        brand: entry.brand,
        brand_slug: entry.brand_slug,
        year: entry.year,
        set_label: entry.set_label,
        set_slug: entry.set_slug,
        download_url: entry.download_url ?? prev.download_url,
        discovery_meta: entry.discovery_meta,
        status: prev.status === "deprecated" ? "pending" : prev.status,
        error: prev.status === "downloaded" ? prev.error : entry.error,
      });
    } else {
      byId.set(entry.id, entry);
      newCount++;
    }
  }

  let deprecatedCount = 0;
  for (const [id, entry] of byId) {
    if (!discoveredIds.has(id) && entry.status !== "deprecated") {
      byId.set(id, { ...entry, status: "deprecated" });
      deprecatedCount++;
    }
  }

  return { entries: [...byId.values()], newCount, deprecatedCount };
}

export function buildCatalog(
  entries: ChecklistCatalogEntry[],
  discovererVersion: string
): ChecklistCatalog {
  return {
    version: 1,
    manufacturer: "panini",
    sport: "basketball",
    source_url: PANINI_CHECKLIST.url,
    discoverer_version: discovererVersion,
    last_discovered_at: new Date().toISOString(),
    entries,
  };
}

export function filterCatalog(
  entries: ChecklistCatalogEntry[],
  filters: { brand?: string; year?: string }
): ChecklistCatalogEntry[] {
  return entries.filter((e) => {
    if (filters.brand && e.brand.toLowerCase() !== filters.brand.toLowerCase()) return false;
    if (filters.year && e.year !== filters.year && !e.year.includes(filters.year)) return false;
    return true;
  });
}

export async function updateCatalogEntry(
  storage: StorageAdapter,
  catalogId: string,
  patch: Partial<ChecklistCatalogEntry>
): Promise<void> {
  const catalog = await loadCatalog(storage);
  if (!catalog) throw new Error("Catalog not found");
  const idx = catalog.entries.findIndex((e) => e.id === catalogId);
  if (idx === -1) throw new Error(`Catalog entry not found: ${catalogId}`);
  catalog.entries[idx] = { ...catalog.entries[idx], ...patch };
  await saveCatalog(storage, catalog);
}
