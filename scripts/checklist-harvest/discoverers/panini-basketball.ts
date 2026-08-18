import { chromium, type Page, type Locator } from "playwright";
import { PANINI_CHECKLIST } from "../config/panini-basketball";
import { listProgramsForBrand } from "../download/panini-api-csv";
import type { ChecklistCatalogEntry } from "../catalog/types";
import type { DiscoverOptions, IDiscoverer } from "./types";
import { buildCatalogId, slugify } from "../utils/slug";
import { Logger } from "../utils/logger";

const DROPDOWN_IDS = {
  sport: "close-dropdown-activity_type",
  year: "close-dropdown-year_type",
  brand: "close-dropdown-brand_type",
  set: "close-dropdown-program_type",
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function dismissModals(page: Page, logger: Logger): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const modal = page.locator("#informationAlert.show, .modal.show").first();
    if (!(await modal.isVisible().catch(() => false))) break;

    const dismiss = modal.locator(
      'button.btn-primary, button:has-text("OK"), button:has-text("Close"), button:has-text("Got it"), button:has-text("Continue"), .btn-close, button.close'
    ).first();

    if (await dismiss.count()) {
      await dismiss.click({ force: true }).catch(() => {});
      logger.debug("modal.dismissed");
    } else {
      await page.keyboard.press("Escape");
    }
    await sleep(600);
  }

  const accept = page.getByRole("button", { name: /accept all/i });
  if (await accept.isVisible({ timeout: 2000 }).catch(() => false)) {
    await accept.click({ force: true }).catch(() => {});
    await sleep(400);
  }
}

async function waitForApp(page: Page): Promise<void> {
  await page.locator("#initial-loader").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => {});
  await page.waitForFunction(
    () => (document.querySelector("#root")?.innerHTML.length ?? 0) > 500,
    { timeout: 120_000 }
  );
  await sleep(1500);
}

function dropdownButton(page: Page, id: string): Locator {
  return page.locator(`#${id}`);
}

async function openDropdownAndGetItems(page: Page, id: string): Promise<Array<{ label: string; index: number }>> {
  return page.evaluate((dropdownId) => {
    const btn = document.querySelector(`#${dropdownId}`) as HTMLElement | null;
    if (!btn) return [];
    btn.click();
    const menu = btn.closest(".dropdown")?.querySelector(".dropdown-menu");
    if (!menu) return [];
    const items = Array.from(menu.querySelectorAll(".dropdown-item"));
    return items
      .map((el, index) => ({
        label: el.getAttribute("aria-label")?.trim() || (el.textContent ?? "").trim(),
        index,
      }))
      .filter((x) => x.label.length > 0);
  }, id);
}

async function selectDropdownByIndex(page: Page, id: string, index: number): Promise<void> {
  await page.evaluate(({ dropdownId, idx }) => {
    const btn = document.querySelector(`#${dropdownId}`) as HTMLElement | null;
    if (!btn) throw new Error(`Dropdown button #${dropdownId} not found`);
    btn.click();
    const menu = btn.closest(".dropdown")?.querySelector(".dropdown-menu");
    const items = menu?.querySelectorAll(".dropdown-item");
    const item = items?.[idx] as HTMLElement | undefined;
    if (!item) throw new Error(`Dropdown item index ${idx} not found in #${dropdownId}`);
    item.click();
  }, { dropdownId: id, idx: index });
  await sleep(PANINI_CHECKLIST.rateLimitMs);
}

async function readDropdownOptions(page: Page, id: string, logger: Logger): Promise<string[]> {
  const btn = dropdownButton(page, id);
  if (!(await btn.isVisible().catch(() => false))) return [];
  await dismissModals(page, logger);
  await btn.scrollIntoViewIfNeeded();
  const items = await openDropdownAndGetItems(page, id);
  await page.keyboard.press("Escape");
  await sleep(200);
  return items.map((i) => i.label);
}

async function selectDropdownOption(page: Page, id: string, label: string, logger: Logger): Promise<boolean> {
  await dismissModals(page, logger);
  await dropdownButton(page, id).scrollIntoViewIfNeeded();
  const items = await openDropdownAndGetItems(page, id);
  const idx = items.findIndex((i) => optionMatches(i.label, label));
  if (idx === -1) {
    logger.warn("discover.option_missing", {
      message: `Option not found in #${id}: ${label}. Available: ${items.map((i) => i.label).join(", ")}`,
    });
    await page.keyboard.press("Escape");
    await sleep(200);
    return false;
  }
  await selectDropdownByIndex(page, id, idx);
  return true;
}

function normalizeOptionLabel(raw: string): string {
  return raw.replace(/^Selected/i, "").trim();
}

function optionMatches(label: string, target: string): boolean {
  const norm = normalizeOptionLabel(label).toLowerCase();
  return norm === target.toLowerCase() || label.toLowerCase() === target.toLowerCase();
}

async function findAndSelectSport(page: Page, targetSport: string, logger: Logger): Promise<string> {
  await dismissModals(page, logger);
  await dropdownButton(page, DROPDOWN_IDS.sport).scrollIntoViewIfNeeded();
  const items = await openDropdownAndGetItems(page, DROPDOWN_IDS.sport);
  const idx = items.findIndex((i) => optionMatches(i.label, targetSport));
  if (idx === -1) {
    throw new Error(
      `Sport "${targetSport}" not found. Available: ${items.map((i) => normalizeOptionLabel(i.label)).join(", ")}`
    );
  }
  await selectDropdownByIndex(page, DROPDOWN_IDS.sport, idx);
  return normalizeOptionLabel(items[idx].label);
}

async function resolveDownloadUrl(page: Page): Promise<string | null> {
  for (const sel of PANINI_CHECKLIST.selectors.downloadLink) {
    const link = page.locator(sel).first();
    if (await link.count() === 0) continue;
    if (!(await link.isVisible().catch(() => false))) continue;

    const href = await link.getAttribute("href");
    if (href && href !== "#" && !href.startsWith("javascript:")) {
      return href.startsWith("http") ? href : new URL(href, PANINI_CHECKLIST.url).href;
    }

    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 8000 }),
        link.click({ force: true }),
      ]);
      const suggested = download.suggestedFilename();
      const url = download.url();
      await download.cancel().catch(() => {});
      if (/\.csv/i.test(suggested) || /\.csv/i.test(url)) return url;
    } catch {
      // no download event
    }
  }
  return null;
}

async function resolveProgramId(
  page: Page,
  year: string,
  brand: string,
  setLabel: string
): Promise<number | undefined> {
  try {
    const { resolveProgramIdEval } = await import("../download/panini-api-csv.browser.js");
    return await page.evaluate(resolveProgramIdEval, { year, brand, setLabel });
  } catch {
    return undefined;
  }
}

function makeEntry(
  year: string,
  brand: string,
  setLabel: string,
  downloadUrl: string | null,
  meta: ChecklistCatalogEntry["discovery_meta"]
): ChecklistCatalogEntry {
  const now = new Date().toISOString();
  const brandSlug = slugify(brand);
  const setSlug = slugify(setLabel);
  const id = buildCatalogId({ year, brand, set_label: setLabel });

  return {
    id,
    manufacturer: "panini",
    sport: "basketball",
    brand,
    brand_slug: brandSlug,
    year,
    set_label: setLabel,
    set_slug: setSlug,
    download_url: downloadUrl,
    file_type: "csv",
    status: "pending",
    discovered_at: now,
    last_attempt_at: null,
    last_success_at: null,
    checksum: null,
    raw_path: null,
    error: downloadUrl ? null : "No CSV download link found at discovery",
    discovery_meta: meta,
  };
}

export class PaniniBasketballDiscoverer implements IDiscoverer {
  readonly id = PANINI_CHECKLIST.discovererVersion;

  async discover(options: DiscoverOptions): Promise<ChecklistCatalogEntry[]> {
    const logger = new Logger({ verbose: true });
    const entries: ChecklistCatalogEntry[] = [];
    const maxEntries = options.maxEntries ?? Infinity;

    const browser = await chromium.launch({ headless: !options.headed });
    const page = await browser.newPage({
      viewport: PANINI_CHECKLIST.viewport,
      userAgent: PANINI_CHECKLIST.userAgent,
    });

    try {
      logger.info("discover.navigate", { message: PANINI_CHECKLIST.url });
      await page.goto(PANINI_CHECKLIST.url, {
        waitUntil: "domcontentloaded",
        timeout: PANINI_CHECKLIST.navigationTimeoutMs,
      });

      await waitForApp(page);
      await dismissModals(page, logger);

      const sportBtn = dropdownButton(page, DROPDOWN_IDS.sport);
      if (!(await sportBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
        throw new Error(
          "Sport dropdown not found — update selectors in config/panini-basketball.ts"
        );
      }

      const targetSport =
        options.sport && options.sport !== "basketball"
          ? options.sport
          : PANINI_CHECKLIST.sport;

      const sportLabel = await findAndSelectSport(page, targetSport, logger);
      logger.info("discover.sport_selected", { message: sportLabel });

            let yearOptions = (await readDropdownOptions(page, DROPDOWN_IDS.year, logger)).map(normalizeOptionLabel);
      if (options.year) {
        yearOptions = yearOptions.filter((y) => y.includes(options.year!));
        logger.info("discover.year_filter", { message: options.year });
      }
      logger.info("discover.years", { message: `${yearOptions.length} years` });

      for (let yi = 0; yi < yearOptions.length; yi++) {
        const year = yearOptions[yi];
        await selectDropdownOption(page, DROPDOWN_IDS.year, year, logger);

        const brandOptions = (await readDropdownOptions(page, DROPDOWN_IDS.brand, logger)).map(normalizeOptionLabel);
        for (let bi = 0; bi < brandOptions.length; bi++) {
          const brand = brandOptions[bi];
          await selectDropdownOption(page, DROPDOWN_IDS.brand, brand, logger);
          await sleep(PANINI_CHECKLIST.dropdownSettleMs);

          const domSetOptions = (await readDropdownOptions(page, DROPDOWN_IDS.set, logger)).map(
            normalizeOptionLabel
          );
          let setOptions = domSetOptions;
          try {
            const apiPrograms = await listProgramsForBrand(year, brand);
            const validNames = new Set(apiPrograms.map((p) => p.name).filter(Boolean) as string[]);
            const filtered = domSetOptions.filter((label) => validNames.has(label));
            if (filtered.length > 0) {
              setOptions = filtered;
            } else if (domSetOptions.length > 0) {
              logger.warn("discover.program_filter_empty", {
                message: `${year}/${brand}: DOM had ${domSetOptions.length} programs but none matched API`,
              });
              continue;
            }
          } catch (err) {
            logger.warn("discover.program_api_filter_failed", {
              message: err instanceof Error ? err.message : String(err),
            });
          }

          for (let si = 0; si < setOptions.length; si++) {
            const setLabel = setOptions[si];
            const setSelected = await selectDropdownOption(page, DROPDOWN_IDS.set, setLabel, logger);
            if (!setSelected) continue;
            await sleep(PANINI_CHECKLIST.rateLimitMs);

            const downloadUrl = options.dryRun ? null : await resolveDownloadUrl(page);
            const pageTitle = await page.title();

            entries.push(
              makeEntry(year, brand, setLabel, downloadUrl, {
                sport_label: sportLabel,
                year_label: year,
                brand_label: brand,
                set_label: setLabel,
                program_id: await resolveProgramId(page, year, brand, setLabel),
                page_title: pageTitle,
              })
            );

            logger.info("discover.entry", {
              catalog_id: entries[entries.length - 1].id,
              message: `${year} / ${brand} / ${setLabel}`,
            });

            if (entries.length >= maxEntries) {
              logger.info("discover.max_reached", { message: String(maxEntries) });
              return entries;
            }
          }
        }
      }

      return entries;
    } finally {
      await browser.close();
    }
  }
}

export function createPaniniBasketballDiscoverer(): PaniniBasketballDiscoverer {
  return new PaniniBasketballDiscoverer();
}
