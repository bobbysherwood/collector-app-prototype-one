import { chromium } from "playwright";
import {
  dismissModals,
  downloadChecklistFromButton,
  navigateToChecklistEntry,
  waitForPaniniApp,
} from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    viewport: PANINI_CHECKLIST.viewport,
    userAgent: PANINI_CHECKLIST.userAgent,
    acceptDownloads: true,
  });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForPaniniApp(page);
  await dismissModals(page);

  await navigateToChecklistEntry(page, {
    year: "2022",
    brand: "Donruss",
    set_label: "Donruss (22-23)",
  });

  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
  );
  console.log("Buttons:", buttons);

  const buf = await downloadChecklistFromButton(page);
  console.log("Success!", buf.length, buf.toString("utf8", 0, 200));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
