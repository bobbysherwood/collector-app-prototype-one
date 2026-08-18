import { chromium } from "playwright";
import { dismissModals, navigateToChecklistEntry, waitForPaniniApp } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

const API = "https://support.paniniamerica.net/replacement-card-selection";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent });
  const page = await context.newPage();
  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });

  const post = (payload: Record<string, string>) =>
    context.request.post(API, {
      data: {
        replace_wo_inventory: "1",
        from_frontend: "0",
        card_set: "",
        card: "",
        ...payload,
      },
    });

  const programs = await (await post({ activity: "9", year: "2022", brand: "Donruss", from_frontend: "2" })).json();
  const program = programs.data.find((p: { name: string }) => p.name === "Donruss (22-23)");
  console.log("program", program);

  const sets = await (await post({ activity: "9", year: "2022", brand: "Donruss", program: String(program.id) })).json();
  console.log("sets", sets.data.length);

  const cards = await (
    await post({
      activity: "9",
      year: "2022",
      brand: "Donruss",
      program: String(program.id),
      card_set: String(sets.data[0].id),
    })
  ).json();
  console.log("cards sample", JSON.stringify(cards.data?.slice(0, 3), null, 2));

  await browser.close();
}

main().catch(console.error);
