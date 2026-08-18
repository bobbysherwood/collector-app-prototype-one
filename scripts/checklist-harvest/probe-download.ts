/**
 * Probe Panini download button — capture network/download events.
 * Run: npx tsx scripts/checklist-harvest/probe-download.ts
 */
import { chromium } from "playwright";
import {
  dismissModals,
  navigateToChecklistEntry,
  waitForPaniniApp,
} from "./browser/panini-page";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: "CollectorApp-ChecklistHarvest/1.0 (+internal research)",
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const events: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (/csv|download|export|blob|checklist/i.test(url)) {
      events.push(`REQ ${req.method()} ${url.slice(0, 200)}`);
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (/csv|download|export|blob|checklist|text\/plain|octet/i.test(url + ct)) {
      let preview = "";
      try {
        const buf = await res.body();
        preview = buf.toString("utf8", 0, 120).replace(/\n/g, " ");
      } catch {
        preview = "(body unavailable)";
      }
      events.push(`RES ${res.status()} ${url.slice(0, 120)} ct=${ct} preview=${preview}`);
    }
  });
  page.on("console", (msg) => {
    if (/csv|download|blob/i.test(msg.text())) events.push(`CONSOLE ${msg.text().slice(0, 200)}`);
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

  await page.waitForTimeout(2000);

  const btnInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button, a")).find((el) =>
      /download full checklist/i.test(el.textContent ?? "")
    );
    if (!btn) return null;
    return {
      tag: btn.tagName,
      text: (btn.textContent ?? "").trim(),
      className: btn.className,
      onclick: btn.getAttribute("onclick"),
      href: btn.getAttribute("href"),
      outer: btn.outerHTML.slice(0, 500),
    };
  });
  console.log("Button:", JSON.stringify(btnInfo, null, 2));

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);

  const btn = page.getByRole("button", { name: /download full checklist/i });
  await btn.click({ force: true });

  const download = await downloadPromise;
  if (download) {
    console.log("Download event:", download.suggestedFilename(), download.url());
    const path = await download.path();
    if (path) {
      const fs = await import("fs/promises");
      const buf = await fs.readFile(path);
      console.log("Download size:", buf.length, "head:", buf.toString("utf8", 0, 200));
    }
  } else {
    console.log("No download event within 30s");
  }

  await page.waitForTimeout(5000);

  // Check for blob URLs in DOM
  const blobs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a")).map((a) => a.href).filter((h) => h.startsWith("blob:"))
  );
  console.log("Blob links:", blobs);

  console.log("\nNetwork events:");
  for (const e of events) console.log(e);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
