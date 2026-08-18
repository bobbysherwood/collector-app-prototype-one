import { type Page, type Locator } from "playwright";
import { PANINI_CHECKLIST } from "../config/panini-basketball";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function dismissModals(page: Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    let acted = false;

    acted =
      (await page.evaluate(() => {
        let clicked = false;
        for (const el of Array.from(document.querySelectorAll("button, a, [role='button']"))) {
          const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
          if (text === "ACCEPT ALL" || text === "Accept All") {
            (el as HTMLElement).click();
            clicked = true;
            break;
          }
        }
        const info = document.querySelector("#informationAlert");
        if (info && (info as HTMLElement).offsetParent !== null) {
          const ok = Array.from(info.querySelectorAll("button")).find(
            (b) => (b.textContent ?? "").trim() === "OK"
          ) as HTMLElement | undefined;
          if (ok) {
            ok.click();
            clicked = true;
          }
        }
        return clicked;
      })) || acted;

    if (acted) await sleep(800);

    const acceptAll = page.getByRole("button", { name: "ACCEPT ALL", exact: true });
    if (await acceptAll.isVisible().catch(() => false)) {
      await acceptAll.click({ force: true });
      await sleep(800);
      acted = true;
    }

    const infoAlert = page.locator("#informationAlert");
    if (await infoAlert.isVisible().catch(() => false)) {
      const ok = infoAlert.getByRole("button", { name: "OK", exact: true });
      if (await ok.isVisible().catch(() => false)) {
        await ok.click({ force: true });
      } else {
        await infoAlert
          .locator('button.btn-primary, .btn-close, button.close')
          .first()
          .click({ force: true })
          .catch(() => {});
      }
      await sleep(800);
      acted = true;
    }

    const modal = page.locator(".modal.show").first();
    if (await modal.isVisible().catch(() => false)) {
      const dismiss = modal.locator(
        'button.btn-primary, button:has-text("OK"), button:has-text("Close"), button:has-text("Got it"), button:has-text("Continue"), .btn-close, button.close'
      ).first();
      if (await dismiss.count()) {
        await dismiss.click({ force: true }).catch(() => {});
      } else {
        await page.keyboard.press("Escape");
      }
      await sleep(600);
      acted = true;
    }

    const accept = page.getByRole("button", { name: /accept all/i });
    if (await accept.isVisible({ timeout: 500 }).catch(() => false)) {
      await accept.click({ force: true }).catch(() => {});
      await sleep(400);
      acted = true;
    }

    if (!acted) break;
  }

  await page.evaluate(() => {
    const info = document.querySelector("#informationAlert") as HTMLElement | null;
    if (info) {
      info.style.setProperty("display", "none", "important");
      info.classList.remove("show");
      info.setAttribute("aria-hidden", "true");
    }

    for (const el of Array.from(document.querySelectorAll("div, section, aside"))) {
      const text = (el.textContent ?? "").slice(0, 200);
      if (/cookie details|third-party cookies|reject all.*accept all/i.test(text)) {
        (el as HTMLElement).style.setProperty("display", "none", "important");
        el.classList.remove("show");
        el.setAttribute("aria-hidden", "true");
      }
    }

    document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  });

  await page
    .locator("#informationAlert")
    .waitFor({ state: "hidden", timeout: 5000 })
    .catch(() => {});
}

export async function waitForPaniniApp(page: Page): Promise<void> {
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
  await page.evaluate(
    ({ dropdownId, idx }) => {
      const btn = document.querySelector(`#${dropdownId}`) as HTMLElement | null;
      if (!btn) throw new Error(`Dropdown button #${dropdownId} not found`);
      btn.click();
      const menu = btn.closest(".dropdown")?.querySelector(".dropdown-menu");
      const items = menu?.querySelectorAll(".dropdown-item");
      const item = items?.[idx] as HTMLElement | undefined;
      if (!item) throw new Error(`Dropdown item index ${idx} not found in #${dropdownId}`);
      item.click();
    },
    { dropdownId: id, idx: index }
  );
  await sleep(PANINI_CHECKLIST.rateLimitMs);
}

function normalizeOptionLabel(raw: string): string {
  return raw.replace(/^Selected/i, "").trim();
}

function optionMatches(label: string, target: string): boolean {
  const norm = normalizeOptionLabel(label).toLowerCase();
  return norm === target.toLowerCase() || label.toLowerCase() === target.toLowerCase();
}

export async function selectDropdownOption(page: Page, id: string, label: string): Promise<void> {
  await dismissModals(page);
  await dropdownButton(page, id).scrollIntoViewIfNeeded();
  const items = await openDropdownAndGetItems(page, id);
  const idx = items.findIndex((i) => optionMatches(i.label, label));
  if (idx === -1) {
    throw new Error(
      `Option not found in #${id}: ${label}. Available: ${items.map((i) => i.label).join(", ")}`
    );
  }
  await selectDropdownByIndex(page, id, idx);
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

async function readBlobCaptures(page: Page): Promise<Buffer | null> {
  const text = await page.evaluate(() => {
    const captures = (window as unknown as { __harvestBlobCaptures?: string[] }).__harvestBlobCaptures ?? [];
    return captures.find((c) => c.includes(",")) ?? null;
  });
  return text ? Buffer.from(text, "utf8") : null;
}

export async function resolveDownloadUrl(page: Page): Promise<string | null> {
  await dismissModals(page);
  await sleep(2000);
  await installBlobCaptureHook(page);

  const downloadButton = page.getByRole("button", { name: /download full checklist/i });
  if (await downloadButton.isVisible().catch(() => false)) {
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20_000 }),
        downloadButton.click({ force: true }),
      ]);
      const suggested = download.suggestedFilename();
      const url = download.url();
      await download.cancel().catch(() => {});
      if (/\.csv/i.test(suggested) || /\.csv/i.test(url)) return url;
    } catch {
      // fall through
    }
  }

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
        page.waitForEvent("download", { timeout: 12_000 }),
        link.click({ force: true }),
      ]);
      const suggested = download.suggestedFilename();
      const url = download.url();
      await download.cancel().catch(() => {});
      if (/\.csv/i.test(suggested) || /\.csv/i.test(url)) return url;
    } catch {
      // try next selector
    }
  }

  return null;
}

export interface ChecklistNavState {
  year?: string;
  brand?: string;
}

export async function navigateToChecklistEntry(
  page: Page,
  entry: { year: string; brand: string; set_label: string }
): Promise<void> {
  await navigateToChecklistEntryIncremental(page, entry);
}

export async function navigateToChecklistEntryIncremental(
  page: Page,
  entry: { year: string; brand: string; set_label: string },
  previous?: ChecklistNavState
): Promise<void> {
  await dismissModals(page);

  if (!previous?.year) {
    await selectDropdownOption(page, "close-dropdown-activity_type", PANINI_CHECKLIST.sport);
  }
  if (!previous || previous.year !== entry.year) {
    await selectDropdownOption(page, "close-dropdown-year_type", entry.year);
  }
  if (!previous || previous.brand !== entry.brand) {
    await selectDropdownOption(page, "close-dropdown-brand_type", entry.brand);
  }
  await selectDropdownOption(page, "close-dropdown-program_type", entry.set_label);

  await dismissModals(page);
  await sleep(PANINI_CHECKLIST.dropdownSettleMs);
}

export async function downloadChecklistFromButton(page: Page): Promise<Buffer> {
  await dismissModals(page);
  await installBlobCaptureHook(page);
  await sleep(1000);

  const btn = page.getByRole("button", { name: /download full checklist/i });
  if (!(await btn.isVisible().catch(() => false))) {
    throw new Error("Download button not visible");
  }

  await btn.scrollIntoViewIfNeeded();

  const clickDownload = async () => {
    await dismissModals(page);
    await btn.click({ force: true });
  };

  try {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 25_000 }),
      clickDownload(),
    ]);
    const path = await download.path();
    if (path) {
      const fs = await import("fs/promises");
      const buf = await fs.readFile(path);
      if (buf.toString("utf8", 0, 200).includes(",")) return buf;
    }
  } catch {
    // fall through to blob capture
  }

  await clickDownload();
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const captured = await readBlobCaptures(page);
    if (captured) return captured;
    await sleep(250);
  }

  throw new Error("No CSV payload captured from download button");
}
