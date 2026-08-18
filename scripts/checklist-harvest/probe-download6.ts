import { chromium } from "playwright";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function acceptConsentOnce(page: import("playwright").Page) {
  await page.evaluate(async () => {
    const win = window as unknown as { __harvestConsentDone?: boolean };
    if (win.__harvestConsentDone) return;
    win.__harvestConsentDone = true;
    await fetch("/onepanini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        operationName: "saveCookieConsent",
        variables: {},
        query:
          'query saveCookieConsent { saveCookieConsent(status: "Accept All", ne_analytics: true, ne_targeted_ads: true, not_shared: true) }',
      }),
    }).catch(() => {});
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const info = document.querySelector("#informationAlert") as HTMLElement | null;
    if (info) info.style.setProperty("display", "none", "important");
    for (const el of Array.from(document.querySelectorAll("div, section, aside"))) {
      const text = (el.textContent ?? "").slice(0, 200);
      if (/cookie details|third-party cookies|reject all/i.test(text)) {
        (el as HTMLElement).style.setProperty("display", "none", "important");
      }
    }
    document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
    document.body.classList.remove("modal-open");
  });
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
        reader.onload = () => {
          const t = String(reader.result ?? "");
          if (t.includes(",")) captures.push(t.slice(0, 500));
        };
        reader.readAsText(obj);
      }
      return url;
    };
  });

  let programResolved = false;
  page.on("response", async (res) => {
    if (!res.url().includes("replacement-card-selection")) return;
    const body = await res.text().catch(() => "");
    if (body.includes('"program":"1155"') || body.includes('"id":1155')) programResolved = true;
    if (body.includes("125097")) programResolved = true;
  });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("#initial-loader").waitFor({ state: "hidden", timeout: 120000 }).catch(() => {});
  await page.waitForFunction(() => (document.querySelector("#root")?.innerHTML.length ?? 0) > 500, { timeout: 120000 });
  await acceptConsentOnce(page);

  // select dropdowns
  for (const [id, label] of [
    ["close-dropdown-activity_type", "Basketball"],
    ["close-dropdown-year_type", "2022"],
    ["close-dropdown-brand_type", "Donruss"],
    ["close-dropdown-program_type", "Donruss (22-23)"],
  ] as const) {
    await page.evaluate(({ dropdownId, target }) => {
      const btn = document.querySelector(`#${dropdownId}`) as HTMLElement;
      btn.click();
      const items = btn.closest(".dropdown")?.querySelectorAll(".dropdown-item");
      const item = Array.from(items ?? []).find((el) =>
        (el.textContent ?? "").trim().includes(target)
      ) as HTMLElement | undefined;
      item?.click();
    }, { dropdownId: id, target: label });
    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(5000);
  console.log("programResolved:", programResolved);

  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }).catch(() => null),
    page.getByRole("button", { name: /download full checklist/i }).click({ force: true }),
  ]);
  await page.waitForTimeout(5000);

  const captures = await page.evaluate(() => (window as unknown as { __captures: string[] }).__captures);
  console.log("download:", dl?.suggestedFilename() ?? "none");
  console.log("captures:", captures.length, captures[0]?.slice(0, 200));

  await browser.close();
}

main().catch(console.error);
