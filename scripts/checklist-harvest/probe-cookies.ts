import { chromium } from "playwright";
import { waitForPaniniApp } from "./browser/panini-page";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("https://www.paniniamerica.net/checklist.html", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForPaniniApp(page);

  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, a, [role='button']"))
      .map((el) => ({
        tag: el.tagName,
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 100),
        aria: el.getAttribute("aria-label"),
        id: el.id,
        className: el.className?.toString().slice(0, 80),
        visible: (el as HTMLElement).offsetParent !== null,
      }))
      .filter((b) => b.visible && /cookie|accept|agree|consent|allow|reject|details/i.test(b.text + (b.aria ?? "")))
  );
  console.log(JSON.stringify(buttons, null, 2));

  // Also check for OneTrust / cookiebot common ids
  const overlays = await page.evaluate(() => ({
    onetrust: !!document.querySelector("#onetrust-banner-sdk, #onetrust-accept-btn-handler"),
    cookiebot: !!document.querySelector("#CybotCookiebotDialog"),
    paniniCookie: Array.from(document.querySelectorAll("[id*='cookie' i], [class*='cookie' i]")).slice(0, 10).map((el) => ({
      id: el.id,
      className: el.className?.toString().slice(0, 80),
      text: (el.textContent ?? "").trim().slice(0, 120),
    })),
  }));
  console.log("Overlays:", JSON.stringify(overlays, null, 2));

  await browser.close();
}

main().catch(console.error);
