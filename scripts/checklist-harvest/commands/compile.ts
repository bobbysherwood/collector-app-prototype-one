import { filterCatalog, loadCatalog } from "../catalog/catalog-store";
import { compileAllBrands } from "../compile/brand-compiler";
import { AI_LOADER_MAX_FILES_PER_SESSION } from "../compile/ai-loader-limits";
import { generateRunId, manifestPath, type RunManifest } from "../manifest/run-manifest";
import { createLogger, createStorageAdapter, resolveGlobalOptions, type GlobalCliOptions } from "./shared";

export interface CompileCommandOptions extends GlobalCliOptions {
  run?: string;
  brand?: string;
}

export async function runCompile(opts: CompileCommandOptions): Promise<number> {
  const global = resolveGlobalOptions(opts);
  const runId = opts.run ?? generateRunId();
  const logger = createLogger(global, runId);
  const storage = createStorageAdapter(global);

  const catalog = await loadCatalog(storage);
  if (!catalog) {
    logger.error("compile.no_catalog", { message: "Run discover first" });
    return 2;
  }

  const entries = filterCatalog(catalog.entries, { brand: opts.brand });
  const brands = await compileAllBrands(entries, storage, runId, opts.brand, logger);

  const manifest: RunManifest = {
    version: 1,
    run_id: runId,
    manufacturer: "panini",
    sport: "basketball",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    status: brands.length > 0 ? "completed" : "partial",
    cli_args: { compile: true, brand: opts.brand ?? "" },
    discovery: { skipped: true, entries_total: entries.length, entries_new: 0, entries_deprecated: 0 },
    download: { attempted: 0, succeeded: 0, skipped_checksum: 0, failed: 0, failures: [] },
    compile: { brands },
    warnings: brands.length === 0 ? ["No compiled brand outputs"] : [],
  };

  await storage.write(manifestPath(runId), JSON.stringify(manifest, null, 2));

  console.log(`\nCompiled ${brands.length} file(s) for run ${runId}`);
  console.log(
    "One CSV per brand when possible (split only if a brand exceeds AI Loader limits)."
  );
  console.log(
    `AI Loader accepts up to ${AI_LOADER_MAX_FILES_PER_SESSION} files per session.\n`
  );
  for (const b of brands) {
    const chunkLabel =
      b.chunk_count > 1 ? ` [${b.chunk_index + 1}/${b.chunk_count}]` : "";
    console.log(
      `  ${b.brand} ${b.year}${chunkLabel}: ${b.row_count} rows (${(b.byte_size / (1024 * 1024)).toFixed(2)} MB) → ${b.output_path}`
    );
  }

  return brands.length > 0 ? 0 : 1;
}

export function registerCompileArgs(cmd: import("commander").Command): void {
  cmd
    .requiredOption("--run <run_id>", "Run ID")
    .option("--brand <label>", "Brand filter")
    .action(async (options, command) => {
      const globals = command.parent?.opts() ?? {};
      process.exit(await runCompile({ ...globals, ...options }));
    });
}
