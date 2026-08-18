import { chromium } from "playwright";
import { dismissModals, navigateToChecklistEntry, waitForPaniniApp } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent });
  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });

  const dropdowns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[id^='close-dropdown-']")).map((el) => ({
      id: el.id,
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
    }))
  );
  console.log(dropdowns);

  await browser.close();
}

main().catch(console.error);
