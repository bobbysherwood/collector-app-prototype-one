import { readdir } from "fs/promises";
import { join } from "path";
import { manifestPath, type RunManifest } from "../manifest/run-manifest";
import { createLogger, createStorageAdapter, resolveGlobalOptions, type GlobalCliOptions } from "./shared";

export interface StatusCommandOptions extends GlobalCliOptions {
  run?: string;
  latest?: boolean;
}

async function findLatestRun(root: string): Promise<string | null> {
  const runsDir = join(root, "staging/runs");
  try {
    const dirs = await readdir(runsDir);
    if (dirs.length === 0) return null;
    dirs.sort().reverse();
    return dirs[0];
  } catch {
    return null;
  }
}

export async function runStatus(opts: StatusCommandOptions): Promise<number> {
  const global = resolveGlobalOptions(opts);
  const logger = createLogger(global);
  const storage = createStorageAdapter(global);

  let runId = opts.run;
  if (!runId && opts.latest) {
    runId = (await findLatestRun(global.root)) ?? undefined;
  }

  if (!runId) {
    logger.error("status.no_run", { message: "Specify --run or --latest" });
    return 1;
  }

  const path = manifestPath(runId);
  if (!(await storage.exists(path))) {
    logger.error("status.not_found", { message: runId });
    return 1;
  }

  const manifest = JSON.parse(await storage.readText(path)) as RunManifest;

  console.log("\n=== Run Status ===");
  console.log(`Run ID:     ${manifest.run_id}`);
  console.log(`Status:     ${manifest.status}`);
  console.log(`Started:    ${manifest.started_at}`);
  console.log(`Finished:   ${manifest.finished_at ?? "—"}`);
  console.log(`Discovery:  ${manifest.discovery.entries_total} entries (${manifest.discovery.entries_new} new)`);
  console.log(
    `Download:   ${manifest.download.succeeded} ok / ${manifest.download.skipped_checksum} skipped / ${manifest.download.failed} failed`
  );
  console.log(`Compile:    ${manifest.compile.brands.length} file(s)`);
  for (const b of manifest.compile.brands) {
    const size =
      "byte_size" in b && typeof b.byte_size === "number"
        ? `, ${(b.byte_size / (1024 * 1024)).toFixed(2)} MB`
        : "";
    const year = "year" in b && b.year ? ` ${b.year}` : "";
    console.log(
      `  ${b.brand}${year}: ${b.source_count} sources, ${b.row_count} rows${size} → ${b.output_path}`
    );
  }
  if (manifest.download.failures.length) {
    console.log("\nFailures:");
    for (const f of manifest.download.failures) {
      console.log(`  ${f.catalog_id}: ${f.error}`);
    }
  }

  return 0;
}

export function registerStatusArgs(cmd: import("commander").Command): void {
  cmd
    .option("--run <run_id>", "Run ID")
    .option("--latest", "Show latest run", false)
    .action(async (options, command) => {
      const globals = command.parent?.opts() ?? {};
      process.exit(await runStatus({ ...globals, ...options }));
    });
}
