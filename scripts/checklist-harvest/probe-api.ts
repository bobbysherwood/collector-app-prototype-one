import { chromium } from "playwright";
import { navigateToChecklistEntry, waitForPaniniApp, dismissModals } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent });

  page.on("request", async (req) => {
    if (!req.url().includes("replacement-card-selection")) return;
    console.log("\n=== REQ replacement-card-selection ===");
    console.log("post:", req.postData()?.slice(0, 2000));
  });

  page.on("response", async (res) => {
    if (!res.url().includes("replacement-card-selection")) return;
    console.log("\n=== RES replacement-card-selection ===", res.status());
    try {
      const text = await res.text();
      console.log("body head:", text.slice(0, 1500));
      if (text.length > 1500) console.log("... total len", text.length);
    } catch (e) {
      console.log("body error", e);
    }
  });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });
  await page.waitForTimeout(3000);

  console.log("\n=== CLICK DOWNLOAD ===");
  await page.locator('button:has-text("DOWNLOAD full CHECKLIST")').first().click({ force: true });
  await page.waitForTimeout(5000);

  await browser.close();
}

main().catch(console.error);
