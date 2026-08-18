import { chromium } from "playwright";
import { waitForPaniniApp } from "./browser/panini-page";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport });
  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);

  const info = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button")).map((b) => {
      const rect = b.getBoundingClientRect();
      const style = getComputedStyle(b);
      return {
        text: (b.textContent ?? "").replace(/\s+/g, " ").trim(),
        disabled: b.disabled,
        display: style.display,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
        rect: { w: rect.width, h: rect.height, x: rect.x, y: rect.y },
        parent: b.parentElement?.className?.toString().slice(0, 80),
        id: b.id,
      };
    });
    const infoAlert = document.querySelector("#informationAlert");
    return {
      buttons: buttons.filter((b) => /accept|ok|cookie|reject/i.test(b.text)),
      infoAlert: infoAlert
        ? {
            className: infoAlert.className,
            display: getComputedStyle(infoAlert).display,
            visibility: getComputedStyle(infoAlert).visibility,
            ariaHidden: infoAlert.getAttribute("aria-hidden"),
            inner: infoAlert.innerHTML.slice(0, 400),
          }
        : null,
    };
  });
  console.log(JSON.stringify(info, null, 2));

  const clicked = await page.evaluate(() => {
    const accept = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === "ACCEPT ALL"
    ) as HTMLButtonElement | undefined;
    if (!accept) return "no accept button";
    accept.click();
    return "clicked accept";
  });
  console.log("click result:", clicked);
  await page.waitForTimeout(2000);

  const after = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((t) => /accept|ok|cookie/i.test(t))
  );
  console.log("cookie buttons after:", after);

  await browser.close();
}

main().catch(console.error);
