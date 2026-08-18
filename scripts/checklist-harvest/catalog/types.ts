export type CatalogEntryStatus = "pending" | "downloaded" | "failed" | "deprecated";

export interface ChecklistCatalogEntry {
  id: string;
  manufacturer: "panini";
  sport: "basketball";
  brand: string;
  brand_slug: string;
  year: string;
  set_label: string;
  set_slug: string;
  download_url: string | null;
  file_type: "csv";
  status: CatalogEntryStatus;
  discovered_at: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  checksum: string | null;
  raw_path: string | null;
  error: string | null;
  discovery_meta?: {
    sport_label?: string;
    year_label?: string;
    brand_label?: string;
    set_label?: string;
    program_id?: number;
    page_title?: string;
  };
}

export interface ChecklistCatalog {
  version: 1;
  manufacturer: "panini";
  sport: "basketball";
  source_url: string;
  discoverer_version: string;
  last_discovered_at: string;
  entries: ChecklistCatalogEntry[];
}

export const CATALOG_PATH = "catalog/panini-basketball.json";
