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
        reader.onload = () => {
          const t = String(reader.result ?? "");
          if (t.includes(",")) captures.push(t);
        };
        reader.readAsText(obj);
      }
      return url;
    };
  });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForPaniniApp(page);
  await dismissModals(page);
  await navigateToChecklistEntry(page, { year: "2022", brand: "Donruss", set_label: "Donruss (22-23)" });
  await dismissModals(page);
  await page.waitForTimeout(3000);

  const reactInfo = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Download Full Checklist"]') as HTMLElement | null;
    if (!btn) return { error: "no button" };
    const key = Object.keys(btn).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
    if (!key) return { error: "no react key", keys: Object.keys(btn).slice(0, 10) };
    let fiber = (btn as unknown as Record<string, unknown>)[key] as { memoizedProps?: { onClick?: unknown }; pendingProps?: { onClick?: unknown } };
    return {
      hasOnClick: !!(fiber?.memoizedProps?.onClick || fiber?.pendingProps?.onClick),
      propsKeys: Object.keys(fiber?.memoizedProps ?? {}),
    };
  });
  console.log("reactInfo:", reactInfo);

  // Try native dispatchEvent click
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Download Full Checklist"]') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  });
  await page.waitForTimeout(5000);

  let captures = await page.evaluate(() => (window as unknown as { __captures: string[] }).__captures);
  console.log("dispatchEvent captures:", captures.length);

  // Try react onClick invoke
  const invoked = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Download Full Checklist"]') as HTMLElement;
    const key = Object.keys(btn).find((k) => k.startsWith("__reactFiber"));
    if (!key) return "no fiber";
    let fiber = (btn as unknown as Record<string, unknown>)[key] as {
      memoizedProps?: { onClick?: (e: unknown) => void };
    };
    const fn = fiber?.memoizedProps?.onClick;
    if (typeof fn !== "function") return "no onClick fn";
    fn({ preventDefault: () => {}, stopPropagation: () => {} });
    return "invoked";
  });
  console.log("react invoke:", invoked);
  await page.waitForTimeout(5000);
  captures = await page.evaluate(() => (window as unknown as { __captures: string[] }).__captures);
  console.log("after react invoke captures:", captures.length, captures[0]?.slice(0, 200));

  await browser.close();
}

main().catch(console.error);
