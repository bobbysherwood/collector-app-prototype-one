import { createHash } from "crypto";
import { parse } from "csv-parse/sync";
import {
  approvedBrandChunkPath,
  approvedBrandPath,
  manifestPath,
  type ApprovedManifest,
} from "../manifest/run-manifest";
import { formatByteSize } from "../compile/ai-loader-limits";
import { createLogger, createStorageAdapter, resolveGlobalOptions, type GlobalCliOptions } from "./shared";

const APPROVED_MANIFEST = "approved/manifest.json";

export interface ApproveCommandOptions extends GlobalCliOptions {
  run: string;
  brand?: string;
  all?: boolean;
}

async function loadApprovedManifest(storage: import("../storage/types").StorageAdapter): Promise<ApprovedManifest> {
  if (await storage.exists(APPROVED_MANIFEST)) {
    const text = await storage.readText(APPROVED_MANIFEST);
    return JSON.parse(text) as ApprovedManifest;
  }
  return { version: 1, approvals: [] };
}

function countCsvRows(bytes: Buffer): number {
  const records = parse(bytes, { columns: true, skip_empty_lines: true, relax_column_count: true });
  return records.length;
}

export async function runApprove(opts: ApproveCommandOptions): Promise<number> {
  const global = resolveGlobalOptions(opts);
  const logger = createLogger(global, opts.run);
  const storage = createStorageAdapter(global);

  const runManifestText = await storage.readText(manifestPath(opts.run));
  const runManifest = JSON.parse(runManifestText) as import("../manifest/run-manifest").RunManifest;

  let brands = runManifest.compile.brands;
  if (opts.brand) {
    brands = brands.filter(
      (b) =>
        b.brand.toLowerCase() === opts.brand!.toLowerCase() ||
        b.brand_slug.toLowerCase() === opts.brand!.toLowerCase()
    );
  }

  if (brands.length === 0) {
    logger.error("approve.no_brands", { message: "No matching compiled brands" });
    return 1;
  }

  if (!opts.all && !opts.brand) {
    console.log("Available compiled files to approve:");
    brands.forEach((b, i) =>
      console.log(
        `  ${i + 1}. ${b.brand} ${b.year} (${b.file_key}) — ${b.row_count} rows, ${formatByteSize(b.byte_size)}`
      )
    );
    console.log("\nUse --brand <label> or --all to approve.");
    return 0;
  }

  const approvedBy =
    process.env.CHECKLIST_HARVEST_APPROVED_BY ??
    process.env.USER ??
    process.env.USERNAME ??
    "unknown";

  const audit = await loadApprovedManifest(storage);

  for (const brand of brands) {
    const src = brand.output_path;
    const dest =
      brand.chunk_count === 1
        ? approvedBrandPath(brand.brand_slug)
        : approvedBrandChunkPath(brand.brand_slug, brand.file_key);
    await storage.copy(src, dest);

    const bytes = await storage.read(dest);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const rowCount = countCsvRows(bytes);

    audit.approvals.push({
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
      run_id: opts.run,
      brand: brand.brand,
      brand_slug: brand.brand_slug,
      year: brand.year,
      file_key: brand.file_key,
      source_path: src,
      approved_path: dest,
      row_count: rowCount,
      byte_size: bytes.length,
      checksum,
    });

    logger.info("approve.promoted", { brand: brand.brand, message: dest });
  }

  await storage.write(APPROVED_MANIFEST, JSON.stringify(audit, null, 2));
  console.log(`\nApproved ${brands.length} compiled file(s).`);
  return 0;
}

export function registerApproveArgs(cmd: import("commander").Command): void {
  cmd
    .requiredOption("--run <run_id>", "Run ID to approve")
    .option("--brand <label>", "Approve single brand")
    .option("--all", "Approve all brands from run", false)
    .action(async (options, command) => {
      const globals = command.parent?.opts() ?? {};
      process.exit(await runApprove({ ...globals, ...options }));
    });
}
