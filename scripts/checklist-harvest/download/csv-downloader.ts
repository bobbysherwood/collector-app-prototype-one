import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  dismissModals,
  navigateToChecklistEntryIncremental,
  waitForPaniniApp,
  type ChecklistNavState,
} from "../browser/panini-page";
import { fetchChecklistCsvViaApi, fetchChecklistCsvViaNodeApi } from "./panini-api-csv";
import { PANINI_CHECKLIST } from "../config/panini-basketball";
import type { ChecklistCatalogEntry } from "../catalog/types";
import { updateCatalogEntry } from "../catalog/catalog-store";
import { rawDownloadPath } from "../manifest/run-manifest";
import type { StorageAdapter } from "../storage/types";
import { sha256 } from "../utils/checksum";
import { Logger } from "../utils/logger";

export interface DownloadResult {
  catalog_id: string;
  success: boolean;
  raw_path: string | null;
  checksum: string | null;
  byte_length: number;
  skipped?: boolean;
  error?: string;
  duration_ms?: number;
  method?: string;
}

const MAX_BYTES = 50 * 1024 * 1024;
const USER_AGENT = PANINI_CHECKLIST.userAgent;

function isAllowedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PANINI_CHECKLIST.allowedDownloadHosts.some(
      (h) => host === h || host.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function validateCsv(bytes: Buffer): Promise<void> {
  if (bytes.length === 0) throw new Error("Empty file");
  if (bytes.length > MAX_BYTES) throw new Error("File exceeds 50MB limit");
  const firstLine = bytes.toString("utf8", 0, Math.min(bytes.length, 4096)).split(/\r?\n/)[0];
  if (!firstLine || !firstLine.includes(",")) {
    throw new Error("Invalid CSV: no header row with columns");
  }
}

async function fetchDirect(url: string): Promise<Buffer> {
  if (!isAllowedHost(url)) throw new Error(`Download host not allowed: ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await validateCsv(buf);
  return buf;
}

async function installBlobCaptureHook(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as { __harvestBlobCaptures?: string[]; __harvestBlobHooked?: boolean };
    if (win.__harvestBlobHooked) return;
    win.__harvestBlobHooked = true;
    win.__harvestBlobCaptures = [];
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob) => {
      const url = origCreate(obj);
      if (obj instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = String(reader.result ?? "");
          if (text.includes(",") && !/^const\s|function\s|\(function/i.test(text.trim())) {
            win.__harvestBlobCaptures!.push(text);
          }
        };
        reader.readAsText(obj);
      }
      return url;
    };
  });
}

class SharedBrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  navState: ChecklistNavState = {};

  async getPage(headed: boolean): Promise<Page> {
    if (this.page) return this.page;

    this.browser = await chromium.launch({ headless: !headed });
    this.context = await this.browser.newContext({
      viewport: PANINI_CHECKLIST.viewport,
      userAgent: USER_AGENT,
      acceptDownloads: true,
    });
    this.page = await this.context.newPage();
    await installBlobCaptureHook(this.page);

    await this.page.goto(PANINI_CHECKLIST.url, {
      waitUntil: "domcontentloaded",
      timeout: PANINI_CHECKLIST.navigationTimeoutMs,
    });
    await waitForPaniniApp(this.page);
    await dismissModals(this.page);

    return this.page;
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.page = null;
    this.context = null;
    this.browser = null;
    this.navState = {};
  }
}

async function fetchViaBrowserApi(
  entry: ChecklistCatalogEntry,
  session: SharedBrowserSession,
  headed: boolean
): Promise<Buffer> {
  const page = await session.getPage(headed);
  await navigateToChecklistEntryIncremental(page, entry, session.navState);
  session.navState = { year: entry.year, brand: entry.brand };

  const bytes = await fetchChecklistCsvViaApi(page, entry);
  await validateCsv(bytes);
  return bytes;
}

async function downloadEntryBytes(
  entry: ChecklistCatalogEntry,
  session: SharedBrowserSession,
  headed: boolean,
  logger: Logger
): Promise<{ bytes: Buffer; method: string }> {
  if (entry.download_url) {
    try {
      const bytes = await fetchDirect(entry.download_url);
      return { bytes, method: "direct_url" };
    } catch (err) {
      logger.info("download.direct_url_failed", {
        catalog_id: entry.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    const bytes = await fetchChecklistCsvViaNodeApi(entry);
    await validateCsv(bytes);
    return { bytes, method: "node_api" };
  } catch (err) {
    logger.info("download.node_api_failed", {
      catalog_id: entry.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const bytes = await fetchViaBrowserApi(entry, session, headed);
  return { bytes, method: "browser_api" };
}

function sortEntriesForIncrementalNav(entries: ChecklistCatalogEntry[]): ChecklistCatalogEntry[] {
  return [...entries].sort((a, b) => {
    const yearCmp = a.year.localeCompare(b.year);
    if (yearCmp !== 0) return yearCmp;
    const brandCmp = a.brand.localeCompare(b.brand);
    if (brandCmp !== 0) return brandCmp;
    return a.set_label.localeCompare(b.set_label);
  });
}

export async function downloadEntry(
  entry: ChecklistCatalogEntry,
  storage: StorageAdapter,
  options: {
    force: boolean;
    headed?: boolean;
    logger?: Logger;
    session?: SharedBrowserSession;
  }
): Promise<DownloadResult> {
  const logger = options.logger ?? new Logger();
  const now = new Date().toISOString();
  const started = Date.now();

  if (entry.checksum && entry.raw_path && !options.force) {
    if (await storage.exists(entry.raw_path)) {
      return {
        catalog_id: entry.id,
        success: true,
        raw_path: entry.raw_path,
        checksum: entry.checksum,
        byte_length: 0,
        skipped: true,
        duration_ms: Date.now() - started,
      };
    }
  }

  const session = options.session ?? new SharedBrowserSession();
  const ownsSession = !options.session;

  try {
    const { bytes, method } = await downloadEntryBytes(
      entry,
      session,
      options.headed ?? false,
      logger
    );

    const checksum = sha256(bytes);
    const rawPath = rawDownloadPath(entry.id, now.replace(/[:.]/g, "-"));
    await storage.write(rawPath, bytes);

    await updateCatalogEntry(storage, entry.id, {
      status: "downloaded",
      checksum,
      raw_path: rawPath,
      last_success_at: now,
      last_attempt_at: now,
      error: null,
    });

    const duration_ms = Date.now() - started;
    logger.info("download.complete", {
      catalog_id: entry.id,
      message: `${rawPath} (${method}, ${duration_ms}ms)`,
    });

    return {
      catalog_id: entry.id,
      success: true,
      raw_path: rawPath,
      checksum,
      byte_length: bytes.length,
      duration_ms,
      method,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateCatalogEntry(storage, entry.id, {
      status: "failed",
      last_attempt_at: now,
      error: message,
    }).catch(() => {});

    logger.error("download.failed", { catalog_id: entry.id, message });

    return {
      catalog_id: entry.id,
      success: false,
      raw_path: null,
      checksum: null,
      byte_length: 0,
      error: message,
      duration_ms: Date.now() - started,
    };
  } finally {
    if (ownsSession) {
      await session.close();
    }
  }
}

export async function downloadEntries(
  entries: ChecklistCatalogEntry[],
  storage: StorageAdapter,
  options: { force: boolean; headed?: boolean; logger?: Logger }
): Promise<DownloadResult[]> {
  const logger = options.logger ?? new Logger();
  const session = new SharedBrowserSession();
  const sorted = sortEntriesForIncrementalNav(entries);
  const results: DownloadResult[] = [];

  try {
    for (const entry of sorted) {
      const result = await downloadEntry(entry, storage, {
        ...options,
        session,
        logger,
      });
      results.push(result);
      await sleep(PANINI_CHECKLIST.apiRateLimitMs);
    }
  } finally {
    await session.close();
  }

  return results;
}
