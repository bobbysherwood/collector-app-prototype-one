import { chromium } from "playwright";
import { dismissModals, navigateToChecklistEntry, waitForPaniniApp } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent });

  page.on("response", async (res) => {
    if (!res.url().includes("replacement-card-selection")) return;
    const req = res.request().postData() ?? "";
    const body = await res.text();
    if (req.includes('"card_set":"125097"') || body.length > 20000) {
      console.log("\nPOST:", req);
      console.log("BODY len:", body.length, "head:", body.slice(0, 800));
    }
  });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });
  await page.waitForTimeout(2000);

  // select Base cardset via dropdown
  await page.evaluate(() => {
    const btn = document.querySelector("#close-dropdown-card_set_type") as HTMLElement;
    btn?.click();
    const items = btn?.closest(".dropdown")?.querySelectorAll(".dropdown-item");
    const base = Array.from(items ?? []).find((el) => (el.textContent ?? "").trim() === "Base") as HTMLElement;
    base?.click();
  });
  await page.waitForTimeout(5000);

  await browser.close();
}

main().catch(console.error);
