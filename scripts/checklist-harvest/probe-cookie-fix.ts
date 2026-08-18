import { chromium } from "playwright";
import { navigateToChecklistEntry, waitForPaniniApp } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function dismissAll(page: import("playwright").Page) {
  // Cookie banner — exact text match
  const acceptAll = page.getByRole("button", { name: "ACCEPT ALL", exact: true });
  if (await acceptAll.isVisible().catch(() => false)) {
    await acceptAll.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Info modal OK
  const ok = page.getByRole("button", { name: "OK", exact: true });
  if (await ok.isVisible().catch(() => false)) {
    await ok.click({ force: true });
    await page.waitForTimeout(800);
  }

  const infoModal = page.locator("#informationAlert.show");
  if (await infoModal.isVisible().catch(() => false)) {
    await infoModal.locator("button.btn-primary, .btn-close, button.close").first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

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
        reader.onload = () => captures.push(String(reader.result).slice(0, 400));
        reader.readAsText(obj);
      }
      return url;
    };
  });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissAll(page);

  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });
  await dismissAll(page);
  await page.waitForTimeout(2000);

  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
  );
  console.log("Visible buttons:", buttons);

  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }).catch(() => null),
    page.getByRole("button", { name: /download full checklist/i }).click(),
  ]);
  await page.waitForTimeout(3000);

  const captures = await page.evaluate(() => (window as unknown as { __captures: string[] }).__captures);
  console.log("Download:", dl ? dl.suggestedFilename() : "none");
  console.log("Blob captures:", captures.length, captures[0]?.slice(0, 200));

  if (dl) {
    const path = await dl.path();
    if (path) {
      const fs = await import("fs/promises");
      const buf = await fs.readFile(path);
      console.log("File size:", buf.length, "head:", buf.toString("utf8", 0, 200));
    }
  }

  await browser.close();
}

main().catch(console.error);
