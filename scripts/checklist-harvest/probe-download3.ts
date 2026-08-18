/**
 * Probe: wait for checklist content before download.
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

  const apiCalls: string[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (/api|checklist|graphql|program|search/i.test(url) && !/cdn-cgi|signifyd|google|rum/i.test(url)) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 300);
      } catch {
        body = "(unreadable)";
      }
      apiCalls.push(`${res.status()} ${url.slice(0, 150)} body=${body.replace(/\n/g, " ")}`);
    }
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

  // Poll page state
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    const state = await page.evaluate(() => ({
      tableRows: document.querySelectorAll("table tr").length,
      cards: document.querySelectorAll("[class*='card'], .checklist, [class*='checklist']").length,
      loaders: document.querySelectorAll(".spinner, .loading, [class*='loader'], [class*='Loader']").length,
      visibleText: document.body.innerText.slice(0, 500),
      downloadDisabled: (() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /download full checklist/i.test(b.textContent ?? "")
        ) as HTMLButtonElement | undefined;
        return btn ? btn.disabled : null;
      })(),
    }));
    console.log(`t=${(i + 1) * 2}s`, JSON.stringify(state));
    if (state.tableRows > 0) break;
  }

  await page.addInitScript(() => {
    // too late for init - use evaluate hook instead
  });

  // Hook createObjectURL in-page now
  await page.evaluate(() => {
    (window as unknown as { __captures: string[] }).__captures = [];
    const captures = (window as unknown as { __captures: string[] }).__captures;
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob) => {
      const url = orig(obj);
      if (obj instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => captures.push(String(reader.result).slice(0, 300));
        reader.readAsText(obj);
      }
      return url;
    };
  });

  const btn = page.getByRole("button", { name: /download full checklist/i });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }).catch(() => null),
    btn.click({ force: true }),
  ]);
  await page.waitForTimeout(5000);

  const captures = await page.evaluate(() => (window as unknown as { __captures: string[] }).__captures ?? []);
  console.log("\nBlob captures:", captures);
  console.log("Download event:", download ? download.suggestedFilename() : null);

  console.log("\nAPI calls:");
  for (const c of apiCalls.slice(-20)) console.log(c);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
