import { chromium } from "playwright";
import { dismissModals, navigateToChecklistEntry, waitForPaniniApp } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent });

  const captured: Array<{ post: string; body: string }> = [];
  page.on("request", (req) => {
    if (req.url().includes("replacement-card-selection") && req.postData()) {
      captured.push({ post: req.postData()!, body: "" });
    }
  });
  page.on("response", async (res) => {
    if (!res.url().includes("replacement-card-selection")) return;
    const body = await res.text();
    for (let i = captured.length - 1; i >= 0; i--) {
      if (!captured[i].body) {
        captured[i].body = body;
        break;
      }
    }
  });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });

  // Trigger card fetch by opening cardset dropdown
  await page.locator("#close-dropdown-card_set_type, [id*='card_set']").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(3000);

  for (const c of captured) {
    console.log("\nPOST:", c.post);
    console.log("BODY head:", c.body.slice(0, 400));
    if (c.body.includes('"card"') || c.body.includes('Athlete') || c.body.includes('player')) {
      console.log(">>> possible cards:", c.body.slice(0, 1200));
    }
  }

  await browser.close();
}

main().catch(console.error);
