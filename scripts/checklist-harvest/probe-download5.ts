import { chromium } from "playwright";
import { dismissModals, navigateToChecklistEntry, waitForPaniniApp } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: PANINI_CHECKLIST.viewport,
    userAgent: PANINI_CHECKLIST.userAgent,
    acceptDownloads: true,
  });

  await page.addInitScript(() => {
    (window as unknown as { __captures: string[] }).__captures = [];
    const captures = (window as unknown as { __captures: string[] }).__captures;
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob) => {
      const url = orig(obj);
      if (obj instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => captures.push(`blob:${obj.size}:${String(reader.result).slice(0, 100)}`);
        reader.readAsText(obj);
      }
      return url;
    };
    const origAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      captures.push(`anchor:${this.href}:${this.download}`);
      return origAnchorClick.call(this);
    };
  });

  page.on("request", (req) => {
    if (req.resourceType() === "fetch" || req.resourceType() === "xhr") {
      console.log("XHR", req.method(), req.url().slice(0, 180), req.postData()?.slice(0, 200));
    }
  });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });
  await dismissModals(page);
  await page.waitForTimeout(3000);

  console.log("\n=== CLICK ===");
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }).catch(() => null),
    page.getByRole("button", { name: /download full checklist/i }).click({ force: true }),
  ]);
  await page.waitForTimeout(8000);

  const captures = await page.evaluate(() => (window as unknown as { __captures: string[] }).__captures);
  console.log("Download event:", dl ? dl.suggestedFilename() : "none");
  console.log("Captures:", captures);

  await browser.close();
}

main().catch(console.error);
