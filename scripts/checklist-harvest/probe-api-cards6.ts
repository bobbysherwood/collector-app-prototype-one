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

  const info = await page.evaluate(async () => {
    const API = "https://support.paniniamerica.net/replacement-card-selection";
    const post = (body: Record<string, string>) =>
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ replace_wo_inventory: "1", from_frontend: "0", card: "", ...body }),
      }).then((r) => r.json());

    const sets = (await post({ activity: "9", year: "2022", brand: "Donruss", program: "1155", card_set: "" })).data;
    const cards = (await post({ activity: "9", year: "2022", brand: "Donruss", program: "1155", card_set: "125097" })).data;
    return { setCount: sets.length, cardCount: cards.length, lastCard: cards[cards.length - 1] };
  });
  console.log(info);

  await browser.close();
}

main().catch(console.error);
