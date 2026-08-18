export interface RunManifest {
  version: 1;
  run_id: string;
  manufacturer: "panini";
  sport: "basketball";
  started_at: string;
  finished_at: string | null;
  status: "running" | "completed" | "failed" | "partial";
  cli_args: Record<string, string | boolean>;
  discovery: {
    skipped: boolean;
    entries_total: number;
    entries_new: number;
    entries_deprecated: number;
  };
  download: {
    attempted: number;
    succeeded: number;
    skipped_checksum: number;
    failed: number;
    failures: Array<{ catalog_id: string; error: string }>;
  };
  compile: {
    brands: Array<{
      brand: string;
      brand_slug: string;
      year: string;
      file_key: string;
      output_path: string;
      source_count: number;
      row_count: number;
      byte_size: number;
      columns: string[];
      source_ids: string[];
      chunk_index: number;
      chunk_count: number;
    }>;
  };
  warnings: string[];
}

export interface ApprovedManifest {
  version: 1;
  approvals: Array<{
    approved_at: string;
    approved_by: string;
    run_id: string;
    brand: string;
    brand_slug: string;
    year: string;
    file_key: string;
    source_path: string;
    approved_path: string;
    row_count: number;
    byte_size: number;
    checksum: string;
  }>;
}

export function manifestPath(runId: string): string {
  return `staging/runs/${runId}/manifest.json`;
}

export function compiledBrandPath(runId: string, brandSlug: string): string {
  return `staging/runs/${runId}/compiled/panini/basketball/${brandSlug}.csv`;
}

export function compiledBrandChunkPath(
  runId: string,
  brandSlug: string,
  fileKey: string
): string {
  return `staging/runs/${runId}/compiled/panini/basketball/${brandSlug}/${fileKey}.csv`;
}

export function rawDownloadPath(catalogId: string, timestamp: string): string {
  return `staging/raw/panini/basketball/${catalogId}/${timestamp}.csv`;
}

/** @deprecated Legacy single-file path. Prefer approvedBrandChunkPath. */
export function approvedBrandPath(brandSlug: string): string {
  return `approved/panini/basketball/${brandSlug}.csv`;
}

export function approvedBrandChunkPath(brandSlug: string, fileKey: string): string {
  return `approved/panini/basketball/${brandSlug}/${fileKey}.csv`;
}

export function generateRunId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const short = Math.random().toString(36).slice(2, 8);
  return `${date}-${short}`;
}
