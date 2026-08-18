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

  const results = await page.evaluate(async () => {
    const API = "https://support.paniniamerica.net/replacement-card-selection";
    const base = {
      activity: "9",
      year: "2022",
      brand: "Donruss",
      program: "1155",
      card_set: "",
      card: "",
      replace_wo_inventory: "1",
    };
    const out: string[] = [];
    for (const ff of ["0", "1", "2", "3", "4", "5", "download", "csv", "export"]) {
      try {
        const r = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ...base, from_frontend: ff }),
        });
        const t = await r.text();
        out.push(`${ff}: ${r.status} len=${t.length} head=${t.slice(0, 120).replace(/\s+/g, " ")}`);
      } catch (e) {
        out.push(`${ff}: error ${String(e)}`);
      }
    }
    return out;
  });

  for (const r of results) console.log(r);

  await browser.close();
}

main().catch(console.error);
