import { chromium } from "playwright";
import { PANINI_CHECKLIST } from "./config/panini-basketball";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: PANINI_CHECKLIST.viewport, userAgent: PANINI_CHECKLIST.userAgent });

  const results: string[] = [];
  page.on("response", async (res) => {
    if (!res.url().includes("replacement-card-selection")) return;
    results.push(await res.text());
  });

  await page.goto(PANINI_CHECKLIST.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("#initial-loader").waitFor({ state: "hidden", timeout: 120000 }).catch(() => {});
  await page.waitForFunction(() => (document.querySelector("#root")?.innerHTML.length ?? 0) > 500, { timeout: 120000 });

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
      const item = Array.from(items ?? []).find((el) => (el.textContent ?? "").trim().includes(target)) as HTMLElement;
      item?.click();
    }, { dropdownId: id, target: label });
    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(3000);
  const last = results[results.length - 1] ?? "";
  console.log("Last API response len:", last.length);
  const parsed = JSON.parse(last);
  const sets = parsed.data?.slice(0, 3) ?? [];
  console.log("Sample sets:", sets);

  // Fetch cards for first set via page fetch (has cookies)
  for (const set of sets) {
    const cardRes = await page.evaluate(async (setId) => {
      const r = await fetch("https://support.paniniamerica.net/replacement-card-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          activity: "9",
          year: "2022",
          brand: "Donruss",
          program: "1155",
          card_set: String(setId),
          card: "",
          replace_wo_inventory: "1",
          from_frontend: "0",
        }),
      });
      return r.text();
    }, set.id);
    console.log(`\nSet ${set.name} (${set.id}):`, cardRes.slice(0, 800));
    break;
  }

  await browser.close();
}

main().catch(console.error);
