import {
  buildCatalog,
  loadCatalog,
  mergeCatalogEntries,
  saveCatalog,
} from "../catalog/catalog-store";
import { PANINI_CHECKLIST } from "../config/panini-basketball";
import { createPaniniBasketballDiscoverer } from "../discoverers/panini-basketball";
import { cliArgsRecord, createLogger, createStorageAdapter, resolveGlobalOptions, type GlobalCliOptions } from "./shared";

export interface DiscoverCommandOptions extends GlobalCliOptions {
  sport?: string;
  manufacturer?: string;
  headed?: boolean;
  dryRun?: boolean;
  maxEntries?: number;
}

export async function runDiscover(opts: DiscoverCommandOptions): Promise<number> {
  const global = resolveGlobalOptions(opts);
  const logger = createLogger(global);
  const storage = createStorageAdapter(global);

  try {
    const discoverer = createPaniniBasketballDiscoverer();
    const discovered = await discoverer.discover({
      headed: opts.headed,
      dryRun: opts.dryRun,
      sport: opts.sport,
      manufacturer: opts.manufacturer,
      maxEntries: opts.maxEntries,
    });

    const existing = await loadCatalog(storage);
    const merged = existing
      ? mergeCatalogEntries(existing.entries, discovered)
      : { entries: discovered, newCount: discovered.length, deprecatedCount: 0 };

    const catalog = buildCatalog(merged.entries, PANINI_CHECKLIST.discovererVersion);
    await saveCatalog(storage, catalog);

    logger.info("discover.complete", {
      message: `${discovered.length} discovered, ${merged.newCount} new, ${merged.deprecatedCount} deprecated`,
    });

    if (opts.dryRun) {
      console.log("\nDry run — sample entries:");
      for (const e of discovered.slice(0, 5)) {
        console.log(`  ${e.id}: ${e.year} / ${e.brand} / ${e.set_label}`);
      }
    }

    const warnings = discovered.filter((e) => !e.download_url);
    if (warnings.length > 0 && !opts.dryRun) {
      logger.warn("discover.missing_urls", { message: `${warnings.length} entries without download URL` });
      return 1;
    }

    return 0;
  } catch (err) {
    logger.error("discover.fatal", {
      message: err instanceof Error ? err.message : String(err),
    });
    console.error("\nFatal: update selectors in config/panini-basketball.ts if DOM changed.");
    return 2;
  }
}

export function registerDiscoverArgs(cmd: import("commander").Command): void {
  cmd
    .option("--sport <sport>", "Sport filter", "basketball")
    .option("--manufacturer <mfg>", "Manufacturer", "panini")
    .option("--headed", "Run browser headed", false)
    .option("--dry-run", "Enumerate without resolving download URLs", false)
    .option("--max-entries <n>", "Stop after N entries (smoke test)", parseInt)
    .action(async (options, command) => {
      const globals = command.parent?.opts() ?? {};
      const code = await runDiscover({ ...globals, ...options });
      process.exit(code);
    });
}

// re-export for typing in cli
void cliArgsRecord;
