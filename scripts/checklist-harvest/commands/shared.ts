import type { StorageAdapter } from "../storage/types";
import { createLocalStorage } from "../storage/local-storage";
import { createSupabaseStorage } from "../storage/supabase-storage";
import { Logger } from "../utils/logger";

export interface GlobalCliOptions {
  storage: "local" | "supabase";
  root: string;
  verbose: boolean;
  jsonLogs: boolean;
}

export function resolveGlobalOptions(opts: Partial<GlobalCliOptions>): GlobalCliOptions {
  return {
    storage: (opts.storage ??
      (process.env.CHECKLIST_HARVEST_STORAGE as "local" | "supabase") ??
      "local") as "local" | "supabase",
    root: opts.root ?? process.env.CHECKLIST_HARVEST_ROOT ?? "./data/checklist-harvest",
    verbose: opts.verbose ?? false,
    jsonLogs: opts.jsonLogs ?? false,
  };
}

export function createStorageAdapter(opts: GlobalCliOptions): StorageAdapter {
  if (opts.storage === "supabase") return createSupabaseStorage();
  return createLocalStorage(opts.root);
}

export function createLogger(opts: GlobalCliOptions, runId?: string): Logger {
  return new Logger({ verbose: opts.verbose, jsonLogs: opts.jsonLogs, runId });
}

export function cliArgsRecord(raw: Record<string, unknown>): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "boolean" || typeof v === "string" ? v : String(v);
  }
  return out;
}
