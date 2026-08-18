/**
 * Probe dropdown selections + cookie dismissal.
 */
import { chromium } from "playwright";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function dismissAll(page: import("playwright").Page) {
  for (let i = 0; i < 8; i++) {
    // Cookie banner buttons
    for (const name of [/accept all/i, /accept cookies/i, /allow all/i, /^accept$/i, /agree/i]) {
      const btn = page.getByRole("button", { name }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        await page.waitForTimeout(800);
      }
    }

    const modal = page.locator("#informationAlert.show, .modal.show").first();
    if (await modal.isVisible().catch(() => false)) {
      const dismiss = modal.locator('button.btn-primary, button:has-text("OK"), .btn-close').first();
      if (await dismiss.count()) await dismiss.click({ force: true });
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    } else break;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator("#initial-loader").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => {});
  await page.waitForFunction(() => (document.querySelector("#root")?.innerHTML.length ?? 0) > 500, { timeout: 120_000 });
  await page.waitForTimeout(2000);
  await dismissAll(page);

  const cookieButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, a"))
      .filter((el) => /cookie|accept|agree|consent/i.test(el.textContent ?? ""))
      .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 80), visible: (el as HTMLElement).offsetParent !== null }))
  );
  console.log("Cookie-related buttons:", cookieButtons);

  // Select Basketball via Playwright click (not evaluate)
  await page.locator("#close-dropdown-activity_type").click({ force: true });
  await page.waitForTimeout(500);
  await page.locator(".dropdown-menu.show .dropdown-item").filter({ hasText: /^Basketball$/i }).first().click({ force: true });
  await page.waitForTimeout(1500);
  await dismissAll(page);

  await page.locator("#close-dropdown-year_type").click({ force: true });
  await page.waitForTimeout(500);
  const yearItems = await page.locator(".dropdown-menu.show .dropdown-item").allTextContents();
  console.log("Year items sample:", yearItems.slice(0, 5));
  await page.locator(".dropdown-menu.show .dropdown-item").filter({ hasText: /^2022$/ }).first().click({ force: true });
  await page.waitForTimeout(1500);

  await page.locator("#close-dropdown-brand_type").click({ force: true });
  await page.waitForTimeout(500);
  await page.locator(".dropdown-menu.show .dropdown-item").filter({ hasText: /^Donruss$/i }).first().click({ force: true });
  await page.waitForTimeout(1500);

  await page.locator("#close-dropdown-program_type").click({ force: true });
  await page.waitForTimeout(500);
  const programs = await page.locator(".dropdown-menu.show .dropdown-item").allTextContents();
  console.log("Programs:", programs);
  await page.locator(".dropdown-menu.show .dropdown-item").filter({ hasText: /Donruss \(22-23\)/ }).first().click({ force: true });
  await page.waitForTimeout(5000);

  const selected = await page.evaluate(() => ({
    sport: document.querySelector("#close-dropdown-activity_type")?.textContent?.trim(),
    year: document.querySelector("#close-dropdown-year_type")?.textContent?.trim(),
    brand: document.querySelector("#close-dropdown-brand_type")?.textContent?.trim(),
    program: document.querySelector("#close-dropdown-program_type")?.textContent?.trim(),
    tableRows: document.querySelectorAll("table tr").length,
    downloadVisible: !!Array.from(document.querySelectorAll("button")).find((b) => /download full checklist/i.test(b.textContent ?? "")),
  }));
  console.log("Selected state:", selected);

  // Try download with hook from init
  const btn = page.getByRole("button", { name: /download full checklist/i });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }).catch(() => null),
    btn.click({ force: true }),
  ]);
  console.log("Download:", dl ? dl.suggestedFilename() : "none");

  await browser.close();
}

main().catch(console.error);
