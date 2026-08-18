import { chromium } from "playwright";
import { navigateToChecklistEntry, waitForPaniniApp, dismissModals } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

const entry = { year: "2022", brand: "Panini", set_label: "Mosaic (22-23)" };

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent });
  page.on("request", (req) => {
    const url = req.url();
    if (/paniniamerica|panini\.com/i.test(url) && !/\.(js|css|png|woff|gif|svg|jpg)/i.test(url)) {
      console.log("req", req.method(), url.slice(0, 200));
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (/paniniamerica|panini\.com/i.test(url) && !/\.(js|css|png|woff|gif|svg|jpg)/i.test(url)) {
      console.log("res", res.status(), res.headers()["content-type"] ?? "", url.slice(0, 200));
    }
  });
  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, entry);
  console.log("click");
  await page.locator('button:has-text("DOWNLOAD full CHECKLIST")').first().click({ force: true });
  await page.waitForTimeout(10000);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
