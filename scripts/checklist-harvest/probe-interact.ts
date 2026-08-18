/**
 * Interactive probe: dismiss modal, walk dropdowns, capture options + download link.
 */
import { chromium } from "playwright";

const HEADED = process.argv.includes("--headed");

async function dismissAllModals(page: import("playwright").Page) {
  for (let i = 0; i < 5; i++) {
    const modal = page.locator(".modal.show, #informationAlert.show, .modal[style*='display: block']");
    if (!(await modal.isVisible().catch(() => false))) break;

    const btn = modal.locator(
      'button.btn-primary, button:has-text("OK"), button:has-text("Close"), button:has-text("Got it"), button:has-text("Continue"), .btn-close, button.close'
    ).first();
    if (await btn.count() > 0) {
      await btn.click({ force: true }).catch(() => {});
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(800);
  }

  const accept = page.getByRole("button", { name: /accept all/i });
  if (await accept.isVisible({ timeout: 2000 }).catch(() => false)) {
    await accept.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function openDropdown(page: import("playwright").Page, buttonId: string) {
  const btn = page.locator(`#${buttonId}`);
  await btn.click({ force: true });
  await page.waitForTimeout(600);
  // Options live in sibling/child dropdown-menu
  const menu = btn.locator("..").locator(".dropdown-menu.show, .dropdown-menu");
  const items = await menu.locator("a, button, li, .dropdown-item").evaluateAll((els) =>
    els
      .map((el) => (el.textContent ?? "").trim())
      .filter((t) => t.length > 0 && t.length < 80)
  );
  return [...new Set(items)];
}

async function selectOption(page: import("playwright").Page, buttonId: string, label: string) {
  await openDropdown(page, buttonId);
  const menu = page.locator(`#${buttonId}`).locator("..").locator(".dropdown-menu.show, .dropdown-menu");
  const opt = menu.locator(`a:has-text("${label}"), button:has-text("${label}"), .dropdown-item:has-text("${label}")`).first();
  if (await opt.count() === 0) {
    // fallback: any element with exact text
    await page.locator(".dropdown-menu.show").getByText(label, { exact: true }).first().click({ force: true });
  } else {
    await opt.click({ force: true });
  }
  await page.waitForTimeout(1500);
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("https://www.paniniamerica.net/checklist.html", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("#initial-loader").waitFor({ state: "hidden", timeout: 120000 }).catch(() => {});
  await page.waitForFunction(
    () => (document.querySelector("#root")?.innerHTML.length ?? 0) > 500,
    { timeout: 120000 }
  );
  await page.waitForTimeout(2000);
  await dismissAllModals(page);

  const sportOptions = await openDropdown(page, "close-dropdown-activity_type");
  console.log("Sport options:", sportOptions);

  await selectOption(page, "close-dropdown-activity_type", "Basketball");
  console.log("Selected Basketball");

  const yearOptions = await openDropdown(page, "close-dropdown-year_type");
  console.log("Year options (first 10):", yearOptions.slice(0, 10));

  if (yearOptions.length > 0) {
    const year = yearOptions.find((y) => /2024|2023/.test(y)) ?? yearOptions[0];
    await selectOption(page, "close-dropdown-year_type", year);
    console.log("Selected year:", year);

    const brandOptions = await openDropdown(page, "close-dropdown-brand_type");
    console.log("Brand options (first 10):", brandOptions.slice(0, 10));

    if (brandOptions.length > 0) {
      const brand = brandOptions[0];
      await selectOption(page, "close-dropdown-brand_type", brand);
      console.log("Selected brand:", brand);

      const programOptions = await openDropdown(page, "close-dropdown-program_type");
      console.log("Program options (first 10):", programOptions.slice(0, 10));

      if (programOptions.length > 0) {
        await selectOption(page, "close-dropdown-program_type", programOptions[0]);
        console.log("Selected program:", programOptions[0]);
        await page.waitForTimeout(2000);

        const downloads = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a, button"))
            .filter((el) => /csv|download|export/i.test((el.textContent ?? "") + (el.getAttribute("href") ?? "")))
            .map((el) => ({
              tag: el.tagName,
              href: el.getAttribute("href"),
              text: (el.textContent ?? "").trim(),
              onclick: el.getAttribute("onclick")?.slice(0, 100) ?? null,
            }))
        );
        console.log("Download links:", JSON.stringify(downloads, null, 2));
      }
    }
  }

  if (HEADED) await page.waitForTimeout(10000);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
