import { chromium } from "playwright";
import { navigateToChecklistEntry, waitForPaniniApp, dismissModals } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });

  for (const wait of [3000, 8000, 15000]) {
    await page.waitForTimeout(wait === 3000 ? 3000 : wait - 3000);
    const snap = await page.evaluate(() => ({
      buttons: Array.from(document.querySelectorAll("button"))
        .filter((b) => (b as HTMLElement).offsetParent !== null)
        .map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80)),
      links: Array.from(document.querySelectorAll("a"))
        .filter((a) => /download|csv|export/i.test((a.textContent ?? "") + (a.href ?? "")))
        .map((a) => ({ text: (a.textContent ?? "").trim(), href: a.href })),
      inputs: document.querySelectorAll("input, select").length,
      reactRootText: document.querySelector("#root")?.textContent?.slice(0, 800),
    }));
    console.log(`\n--- after ${wait}ms ---`);
    console.log(JSON.stringify(snap, null, 2));
  }

  await browser.close();
}

main().catch(console.error);
