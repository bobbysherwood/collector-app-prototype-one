import {
  buildCatalog,
  loadCatalog,
  mergeCatalogEntries,
  saveCatalog,
} from "../catalog/catalog-store";
import { compileAllBrands } from "../compile/brand-compiler";
import { downloadEntries } from "../download/csv-downloader";
import { PANINI_CHECKLIST } from "../config/panini-basketball";
import { createPaniniBasketballDiscoverer } from "../discoverers/panini-basketball";
import { generateRunId, manifestPath, type RunManifest } from "../manifest/run-manifest";
import {
  cliArgsRecord,
  createLogger,
  createStorageAdapter,
  resolveGlobalOptions,
  type GlobalCliOptions,
} from "./shared";

export interface RunCommandOptions extends GlobalCliOptions {
  skipDiscover?: boolean;
  brand?: string;
  year?: string;
  force?: boolean;
  strict?: boolean;
  resume?: string;
  headed?: boolean;
  dryRun?: boolean;
  maxEntries?: number;
}

export async function runPipeline(opts: RunCommandOptions): Promise<number> {
  const global = resolveGlobalOptions(opts);
  const runId = opts.resume ?? generateRunId();
  const logger = createLogger(global, runId);
  const storage = createStorageAdapter(global);

  const manifest: RunManifest = {
    version: 1,
    run_id: runId,
    manufacturer: "panini",
    sport: "basketball",
    started_at: new Date().toISOString(),
    finished_at: null,
    status: "running",
    cli_args: cliArgsRecord(opts as unknown as Record<string, unknown>),
    discovery: { skipped: false, entries_total: 0, entries_new: 0, entries_deprecated: 0 },
    download: { attempted: 0, succeeded: 0, skipped_checksum: 0, failed: 0, failures: [] },
    compile: { brands: [] },
    warnings: [],
  };

  await storage.write(manifestPath(runId), JSON.stringify(manifest, null, 2));

  try {
    // Discover
    if (!opts.skipDiscover) {
      logger.info("run.discover");
      const discoverer = createPaniniBasketballDiscoverer();
      const discovered = await discoverer.discover({
        headed: opts.headed,
        dryRun: opts.dryRun,
        maxEntries: opts.maxEntries,
        year: opts.year,
      });

      const existing = await loadCatalog(storage);
      const merged = existing
        ? mergeCatalogEntries(existing.entries, discovered)
        : { entries: discovered, newCount: discovered.length, deprecatedCount: 0 };

      await saveCatalog(storage, buildCatalog(merged.entries, PANINI_CHECKLIST.discovererVersion));

      manifest.discovery = {
        skipped: false,
        entries_total: merged.entries.length,
        entries_new: merged.newCount,
        entries_deprecated: merged.deprecatedCount,
      };
    } else {
      manifest.discovery.skipped = true;
      const catalog = await loadCatalog(storage);
      manifest.discovery.entries_total = catalog?.entries.length ?? 0;
    }

    const catalog = await loadCatalog(storage);
    if (!catalog) throw new Error("Catalog missing after discover");

    let entries = catalog.entries.filter((e) => e.status !== "deprecated");
    if (opts.brand || opts.year) {
      entries = entries.filter((e) => {
        if (opts.brand && e.brand.toLowerCase() !== opts.brand.toLowerCase()) return false;
        if (opts.year && !e.year.includes(opts.year)) return false;
        return true;
      });
    }

    if (opts.resume && !opts.force) {
      entries = entries.filter((e) => e.status !== "downloaded");
    }

    // Download
    if (!opts.dryRun) {
      logger.info("run.download", { message: `${entries.length} entries` });
      const results = await downloadEntries(entries, storage, {
        force: opts.force ?? false,
        headed: opts.headed,
        logger,
      });

      manifest.download.attempted = results.length;
      manifest.download.succeeded = results.filter((r) => r.success && !r.skipped).length;
      manifest.download.skipped_checksum = results.filter((r) => r.skipped).length;
      manifest.download.failed = results.filter((r) => !r.success).length;
      manifest.download.failures = results
        .filter((r) => !r.success)
        .map((r) => ({ catalog_id: r.catalog_id, error: r.error ?? "unknown" }));

      if (opts.strict && manifest.download.failed > 0) {
        manifest.status = "failed";
        manifest.finished_at = new Date().toISOString();
        await storage.write(manifestPath(runId), JSON.stringify(manifest, null, 2));
        return 1;
      }
    } else {
      manifest.discovery.skipped = opts.skipDiscover ?? false;
      manifest.warnings.push("Dry run — skipped download and compile");
    }

    // Compile
    if (!opts.dryRun) {
      const freshCatalog = await loadCatalog(storage);
      const compileEntries = freshCatalog?.entries ?? [];
      const brands = await compileAllBrands(
        compileEntries,
        storage,
        runId,
        opts.brand,
        logger
      );
      manifest.compile.brands = brands;
    }

    manifest.status =
      manifest.download.failed > 0 ? "partial" : "completed";
    manifest.finished_at = new Date().toISOString();
    await storage.write(manifestPath(runId), JSON.stringify(manifest, null, 2));

    printSummary(manifest);
    return manifest.download.failed > 0 ? 1 : 0;
  } catch (err) {
    manifest.status = "failed";
    manifest.finished_at = new Date().toISOString();
    manifest.warnings.push(err instanceof Error ? err.message : String(err));
    await storage.write(manifestPath(runId), JSON.stringify(manifest, null, 2)).catch(() => {});
    logger.error("run.fatal", { message: err instanceof Error ? err.message : String(err) });
    return 2;
  }
}

function printSummary(m: RunManifest): void {
  console.log("\n=== Checklist Harvest Run Summary ===");
  console.log(`Run ID:    ${m.run_id}`);
  console.log(`Status:    ${m.status}`);
  console.log(`Discovery: ${m.discovery.entries_total} total (${m.discovery.entries_new} new)`);
  console.log(
    `Download:  ${m.download.succeeded} ok, ${m.download.skipped_checksum} skipped, ${m.download.failed} failed`
  );
  console.log(`Compile:   ${m.compile.brands.length} file(s) (brand/year chunks for AI Loader)`);
  for (const b of m.compile.brands) {
    const year = "year" in b && b.year ? ` ${b.year}` : "";
    const size =
      "byte_size" in b && typeof b.byte_size === "number"
        ? `, ${(b.byte_size / (1024 * 1024)).toFixed(2)} MB`
        : "";
    console.log(`  - ${b.brand}${year}: ${b.row_count} rows${size}`);
  }
  if (m.warnings.length) console.log(`Warnings:  ${m.warnings.join("; ")}`);
}

export function registerRunArgs(cmd: import("commander").Command): void {
  cmd
    .option("--skip-discover", "Use existing catalog", false)
    .option("--brand <label>", "Brand filter")
    .option("--year <label>", "Year filter")
    .option("--force", "Force re-download", false)
    .option("--strict", "Fail on any download error", false)
    .option("--resume <run_id>", "Resume prior run")
    .option("--headed", "Headed browser", false)
    .option("--dry-run", "Discover only, no download/compile", false)
    .option("--max-entries <n>", "Limit discovery entries", parseInt)
    .action(async (options, command) => {
      const globals = command.parent?.opts() ?? {};
      process.exit(await runPipeline({ ...globals, ...options }));
    });
}
