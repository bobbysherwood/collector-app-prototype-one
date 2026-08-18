import { chromium } from "playwright";
import { dismissModals, navigateToChecklistEntry, waitForPaniniApp } from "./browser/panini-page";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.resourceType() === "fetch" || req.resourceType() === "xhr") {
      requests.push(`${req.method()} ${req.url()}`);
    }
  });
  page.on("response", async (res) => {
    const rt = res.request().resourceType();
    if (rt !== "fetch" && rt !== "xhr") return;
    const url = res.url();
    let preview = "";
    try {
      preview = (await res.text()).slice(0, 200).replace(/\s+/g, " ");
    } catch {
      preview = "(binary)";
    }
    requests.push(`<< ${res.status()} ${url.slice(0, 150)} ${preview}`);
  });

  await page.goto("https://www.paniniamerica.net/checklist.html", { waitUntil: "networkidle", timeout: 120_000 }).catch(() => {});
  await waitForPaniniApp(page);
  await dismissModals(page);

  // Accept cookies aggressively
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    for (const b of btns) {
      const t = (b.textContent ?? "").toLowerCase();
      if (t.includes("accept all") || t === "accept" || t.includes("allow all")) {
        (b as HTMLElement).click();
      }
    }
  });
  await page.waitForTimeout(2000);
  await dismissModals(page);

  requests.length = 0; // clear initial

  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });
  await page.waitForTimeout(10000);

  console.log("XHR/fetch after selection:");
  for (const r of requests) console.log(r);

  const state = await page.evaluate(() => ({
    selected: {
      year: document.querySelector("#close-dropdown-year_type")?.textContent?.trim(),
      brand: document.querySelector("#close-dropdown-brand_type")?.textContent?.trim(),
      program: document.querySelector("#close-dropdown-program_type")?.textContent?.trim(),
    },
    rows: document.querySelectorAll("table tr, [role='row']").length,
    innerLen: document.body.innerText.length,
  }));
  console.log("\nState:", state);

  await browser.close();
}

main().catch(console.error);
