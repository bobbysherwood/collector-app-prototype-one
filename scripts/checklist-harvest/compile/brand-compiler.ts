import type { ChecklistCatalogEntry } from "../catalog/types";
import { buildNormalizedRows, splitChecklistCsv } from "./csv-concat";
import { formatByteSize } from "./ai-loader-limits";
import {
  compiledBrandChunkPath,
  compiledBrandPath,
} from "../manifest/run-manifest";
import type { StorageAdapter } from "../storage/types";
import { Logger } from "../utils/logger";

export interface CompileBrandResult {
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
}

export function groupByBrand(
  entries: ChecklistCatalogEntry[]
): Map<string, ChecklistCatalogEntry[]> {
  const map = new Map<string, ChecklistCatalogEntry[]>();
  for (const entry of entries) {
    if (entry.status !== "downloaded" || !entry.raw_path) continue;
    const list = map.get(entry.brand_slug) ?? [];
    list.push(entry);
    map.set(entry.brand_slug, list);
  }
  return map;
}

function fileKeyForChunk(chunkIndex: number, chunkCount: number): string {
  if (chunkCount === 1) return "all";
  return `part-${String(chunkIndex + 1).padStart(2, "0")}`;
}

export async function compileBrand(
  brandSlug: string,
  entries: ChecklistCatalogEntry[],
  storage: StorageAdapter,
  runId: string,
  logger: Logger
): Promise<CompileBrandResult[]> {
  const brand = entries[0]?.brand ?? brandSlug;
  const sources: Array<{ path: string; entry: ChecklistCatalogEntry; bytes: Buffer }> = [];

  for (const entry of entries) {
    if (!entry.raw_path) continue;
    try {
      const bytes = await storage.read(entry.raw_path);
      sources.push({ path: entry.raw_path, entry, bytes });
    } catch (err) {
      logger.warn("compile.read_failed", {
        catalog_id: entry.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (sources.length === 0) {
    logger.warn("compile.no_sources", { brand, message: brandSlug });
    return [];
  }

  let rows;
  try {
    rows = buildNormalizedRows(sources);
  } catch (err) {
    logger.warn("compile.concat_failed", {
      brand,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  if (rows.length === 0) {
    logger.warn("compile.zero_rows", { brand, message: brandSlug });
    return [];
  }

  let chunks;
  try {
    chunks = splitChecklistCsv(rows);
  } catch (err) {
    logger.warn("compile.split_failed", {
      brand,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  const results: CompileBrandResult[] = [];

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]!;
    const fileKey = fileKeyForChunk(chunkIndex, chunks.length);
    const outputPath =
      chunks.length === 1
        ? compiledBrandPath(runId, brandSlug)
        : compiledBrandChunkPath(runId, brandSlug, fileKey);

    await storage.write(outputPath, chunk.csv);

    results.push({
      brand,
      brand_slug: brandSlug,
      year: "all",
      file_key: chunks.length === 1 ? brandSlug : fileKey,
      output_path: outputPath,
      source_count: sources.length,
      row_count: chunk.rowCount,
      byte_size: chunk.byteSize,
      columns: chunk.columns,
      source_ids: sources.map((s) => s.entry.id),
      chunk_index: chunkIndex,
      chunk_count: chunks.length,
    });
  }

  return results;
}

export async function compileAllBrands(
  entries: ChecklistCatalogEntry[],
  storage: StorageAdapter,
  runId: string,
  brandFilter?: string,
  logger?: Logger
): Promise<CompileBrandResult[]> {
  const log = logger ?? new Logger();
  const groups = groupByBrand(entries);
  const results: CompileBrandResult[] = [];

  const sortedBrandSlugs = [...groups.keys()].sort();

  for (const brandSlug of sortedBrandSlugs) {
    const group = groups.get(brandSlug)!;

    if (brandFilter && brandSlug.toLowerCase() !== brandFilter.toLowerCase()) {
      const brandMatch = group.some(
        (e) => e.brand.toLowerCase() === brandFilter.toLowerCase()
      );
      if (!brandMatch) continue;
    }

    const compiled = await compileBrand(brandSlug, group, storage, runId, log);
    results.push(...compiled);
  }

  return results;
}

export function summarizeCompileResults(results: CompileBrandResult[]): string {
  const byBrand = new Map<string, CompileBrandResult[]>();
  for (const result of results) {
    const list = byBrand.get(result.brand_slug) ?? [];
    list.push(result);
    byBrand.set(result.brand_slug, list);
  }

  return [...byBrand.entries()]
    .map(([slug, files]) => {
      const rows = files.reduce((sum, file) => sum + file.row_count, 0);
      const bytes = files.reduce((sum, file) => sum + file.byte_size, 0);
      return `${slug}: ${files.length} file(s), ${rows} rows, ${formatByteSize(bytes)}`;
    })
    .join("\n");
}
