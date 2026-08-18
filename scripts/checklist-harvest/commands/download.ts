import { filterCatalog, loadCatalog } from "../catalog/catalog-store";
import { downloadEntries } from "../download/csv-downloader";
import { createLogger, createStorageAdapter, resolveGlobalOptions, type GlobalCliOptions } from "./shared";

export interface DownloadCommandOptions extends GlobalCliOptions {
  brand?: string;
  year?: string;
  force?: boolean;
  headed?: boolean;
  resume?: string;
  failedOnly?: boolean;
}

export async function runDownload(opts: DownloadCommandOptions): Promise<number> {
  const global = resolveGlobalOptions(opts);
  const logger = createLogger(global, opts.resume);
  const storage = createStorageAdapter(global);

  const catalog = await loadCatalog(storage);
  if (!catalog) {
    logger.error("download.no_catalog", { message: "Run discover first" });
    return 2;
  }

  let entries = filterCatalog(catalog.entries, { brand: opts.brand, year: opts.year });
  entries = entries.filter((e) => e.status !== "deprecated");

  if (opts.failedOnly) {
    entries = entries.filter((e) => e.status === "failed");
  }

  if (opts.resume) {
    // Skip already downloaded unless force
    if (!opts.force) {
      entries = entries.filter((e) => e.status !== "downloaded");
    }
  }

  logger.info("download.start", { message: `${entries.length} entries` });

  const results = await downloadEntries(entries, storage, {
    force: opts.force ?? false,
    headed: opts.headed,
    logger,
  });

  const failed = results.filter((r) => !r.success);
  const skipped = results.filter((r) => r.skipped);

  console.log(`\nDownload summary: ${results.length - failed.length} ok, ${skipped.length} skipped, ${failed.length} failed`);

  return failed.length > 0 ? 1 : 0;
}

export function registerDownloadArgs(cmd: import("commander").Command): void {
  cmd
    .option("--brand <label>", "Brand filter")
    .option("--year <label>", "Year filter")
    .option("--force", "Re-download even if checksum matches", false)
    .option("--failed-only", "Download only failed catalog entries", false)
    .option("--headed", "Headed browser for replay downloads", false)
    .option("--resume <run_id>", "Resume prior run")
    .action(async (options, command) => {
      const globals = command.parent?.opts() ?? {};
      process.exit(await runDownload({ ...globals, ...options }));
    });
}
