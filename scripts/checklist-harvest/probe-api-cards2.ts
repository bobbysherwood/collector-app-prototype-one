import { chromium } from "playwright";
import { dismissModals, navigateToChecklistEntry, waitForPaniniApp } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

const API = "https://support.paniniamerica.net/replacement-card-selection";
const BASKETBALL_ID = "9";

async function apiPost(page: import("playwright").Page, body: Record<string, string>) {
  return page.evaluate(
    async ({ url, payload }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          replace_wo_inventory: "1",
          from_frontend: "0",
          card_set: "",
          card: "",
          ...payload,
        }),
      });
      return res.json();
    },
    { url: API, payload: body }
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent });
  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });
  await dismissModals(page);

  const programs = await apiPost(page, { activity: BASKETBALL_ID, year: "2022", brand: "Donruss", from_frontend: "2" });
  const program = programs.data?.find((p: { name: string }) => p.name === "Donruss (22-23)");
  console.log("program:", program);

  const sets = await apiPost(page, {
    activity: BASKETBALL_ID,
    year: "2022",
    brand: "Donruss",
    program: String(program.id),
  });
  console.log("set count:", sets.data?.length);

  const cards = await apiPost(page, {
    activity: BASKETBALL_ID,
    year: "2022",
    brand: "Donruss",
    program: String(program.id),
    card_set: String(sets.data[0].id),
  });
  console.log("cards sample:", JSON.stringify(cards.data?.slice(0, 5), null, 2));

  await browser.close();
}

main().catch(console.error);
