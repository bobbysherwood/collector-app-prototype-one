import { loadCatalog, saveCatalog } from "../catalog/catalog-store";
import { repairBrandDuplicates } from "../catalog/repair-brand-duplicates";
import { createLogger, createStorageAdapter, resolveGlobalOptions, type GlobalCliOptions } from "./shared";

export async function runRepairCatalog(opts: GlobalCliOptions): Promise<number> {
  const global = resolveGlobalOptions(opts);
  const logger = createLogger(global);
  const storage = createStorageAdapter(global);

  const catalog = await loadCatalog(storage);
  if (!catalog) {
    logger.error("repair.no_catalog", { message: "Catalog not found" });
    return 2;
  }

  const result = repairBrandDuplicates(catalog);
  await saveCatalog(storage, catalog);

  console.log(`Deprecated ${result.deprecatedIds.length} misassigned duplicate(s).`);
  if (result.skippedIds.length) {
    console.log(`Skipped ${result.skippedIds.length} entry(ies) without a canonical sibling.`);
  }

  return 0;
}

export function registerRepairCatalogArgs(cmd: import("commander").Command): void {
  cmd.action(async (_options, command) => {
    const globals = command.parent?.opts() ?? {};
    process.exit(await runRepairCatalog(globals));
  });
}
