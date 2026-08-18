import { chromium } from "playwright";
import { dismissModals, navigateToChecklistEntry, waitForPaniniApp } from "./browser/panini-page";
import { fetchChecklistCsvViaApi } from "./download/panini-api-csv";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: PANINI_CHECKLIST.viewport,
    userAgent: PANINI_CHECKLIST.userAgent,
  });
  const page = await context.newPage();
  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });

  const buf = await fetchChecklistCsvViaApi(page, {
    year: "2022",
    brand: "Donruss",
    set_label: "Donruss (22-23)",
    discovery_meta: { program_id: 1155 },
  });

  console.log("bytes", buf.length);
  console.log("head", buf.toString("utf8", 0, 300));
  console.log("lines", buf.toString("utf8").split(/\r?\n/).length);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
