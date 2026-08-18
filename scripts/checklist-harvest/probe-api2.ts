import { chromium } from "playwright";
import { navigateToChecklistEntry, waitForPaniniApp, dismissModals } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent, acceptDownloads: true });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });
  await page.waitForTimeout(3000);

  const after: string[] = [];
  page.on("request", (req) => after.push(`REQ ${req.method()} ${req.url().slice(0, 200)}`));
  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] ?? "";
    let extra = "";
    if (/json|csv|text\/plain|octet/i.test(ct)) {
      try {
        extra = (await res.text()).slice(0, 300).replace(/\s+/g, " ");
      } catch {
        extra = "(binary)";
      }
    }
    after.push(`RES ${res.status()} ${ct} ${res.url().slice(0, 150)} ${extra}`);
  });

  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }).catch(() => null),
    page.getByRole("button", { name: /download full checklist/i }).click({ force: true }),
  ]);
  await page.waitForTimeout(8000);

  console.log("Download event:", dl ? `${dl.suggestedFilename()} ${dl.url()}` : "none");
  console.log("\nNetwork after click:");
  for (const l of after) console.log(l);

  await browser.close();
}

main().catch(console.error);
