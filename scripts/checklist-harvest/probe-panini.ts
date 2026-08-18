import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.paniniamerica.net/checklist.html", {
    waitUntil: "networkidle",
    timeout: 60000,
  });

  // Accept cookies if present
  const accept = page.getByRole("button", { name: /accept all/i });
  if (await accept.isVisible({ timeout: 5000 }).catch(() => false)) {
    await accept.click();
    await page.waitForTimeout(1000);
  }

  const selects = await page.locator("select").evaluateAll((els) =>
    els.map((el, index) => ({
      index,
      id: el.id,
      name: el.getAttribute("name"),
      className: el.className,
      optionCount: el.querySelectorAll("option").length,
      firstOptions: Array.from(el.querySelectorAll("option"))
        .slice(0, 8)
        .map((o) => ({ value: o.value, text: o.textContent?.trim() })),
    }))
  );

  console.log(JSON.stringify({ selects }, null, 2));

  // Try select Basketball on first select with Basketball option
  for (let i = 0; i < selects.length; i++) {
    const hasBasketball = selects[i].firstOptions.some((o) =>
      /basketball/i.test(o.text ?? "")
    );
    if (hasBasketball) {
      await page.locator("select").nth(i).selectOption({ label: "Basketball" });
      await page.waitForTimeout(2000);
      break;
    }
  }

  const afterSport = await page.locator("select").evaluateAll((els) =>
    els.map((el, index) => ({
      index,
      id: el.id,
      optionCount: el.querySelectorAll("option").length,
      options: Array.from(el.querySelectorAll("option"))
        .slice(0, 15)
        .map((o) => o.textContent?.trim()),
    }))
  );

  console.log("\nAfter Basketball:\n", JSON.stringify({ afterSport }, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
