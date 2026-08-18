/**
 * Deep probe: hook blob/anchor creation on download click.
 */
import { chromium } from "playwright";
import {
  dismissModals,
  navigateToChecklistEntry,
  waitForPaniniApp,
} from "./browser/panini-page";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    userAgent: "CollectorApp-ChecklistHarvest/1.0 (+internal research)",
    acceptDownloads: true,
  });

  await page.addInitScript(() => {
    (window as unknown as { __harvestCaptures: string[] }).__harvestCaptures = [];
    const captures = (window as unknown as { __harvestCaptures: string[] }).__harvestCaptures;

    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob) => {
      const url = origCreate(obj);
      if (obj instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = String(reader.result ?? "").slice(0, 500);
          captures.push(`createObjectURL blob size=${obj.size} type=${obj.type} head=${text}`);
        };
        reader.readAsText(obj);
      }
      return url;
    };

    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      captures.push(
        `anchor.click href=${this.href} download=${this.download} text=${(this.textContent ?? "").slice(0, 80)}`
      );
      return origClick.call(this);
    };
  });

  await page.goto("https://www.paniniamerica.net/checklist.html", {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await waitForPaniniApp(page);
  await dismissModals(page);

  await navigateToChecklistEntry(page, {
    year: "2022",
    brand: "Donruss",
    set_label: "Donruss (22-23)",
  });

  await page.waitForTimeout(3000);

  const btn = page.getByRole("button", { name: /download full checklist/i });
  console.log("Button visible:", await btn.isVisible());

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }).catch(() => null),
    btn.click({ force: true }),
  ]);

  await page.waitForTimeout(8000);

  const captures = await page.evaluate(() => (window as unknown as { __harvestCaptures: string[] }).__harvestCaptures);
  console.log("Captures:", captures);

  if (download) {
    console.log("Download:", download.suggestedFilename(), download.url());
  }

  // Try fetching any blob URLs currently in page
  const blobUrls = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href^='blob:']")).map((a) => ({
      href: (a as HTMLAnchorElement).href,
      download: (a as HTMLAnchorElement).download,
    }))
  );
  console.log("Blob anchors:", blobUrls);

  // Dump table/checklist area text length
  const content = await page.evaluate(() => {
    const table = document.querySelector("table");
    return {
      tableRows: table?.querySelectorAll("tr").length ?? 0,
      bodyTextLen: document.body.innerText.length,
      hasDownloadBtn: !!Array.from(document.querySelectorAll("button")).find((b) =>
        /download full checklist/i.test(b.textContent ?? "")
      ),
    };
  });
  console.log("Page content:", content);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
