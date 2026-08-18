/**
 * Deep DOM probe for Panini checklist page — waits for React SPA, discovers dropdowns.
 * Run: npx tsx scripts/checklist-harvest/probe-panini-deep.ts [--headed]
 */
import { chromium, type Page } from "playwright";
import { writeFileSync } from "fs";
import { join } from "path";

const HEADED = process.argv.includes("--headed");
const URL = "https://www.paniniamerica.net/checklist.html";
const OUT_DIR = join(__dirname, "probe-output");

async function dismissModals(page: Page) {
  const infoModal = page.locator("#informationAlert");
  if (await infoModal.isVisible({ timeout: 2000 }).catch(() => false)) {
    const closeBtn = infoModal.locator(
      'button.close, button[data-dismiss="modal"], .btn-close, button:has-text("OK"), button:has-text("Close"), button:has-text("Got it")'
    ).first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click({ force: true }).catch(() => {});
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(500);
  }

  const accept = page.getByRole("button", { name: /accept all/i });
  if (await accept.isVisible({ timeout: 3000 }).catch(() => false)) {
    await accept.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function waitForApp(page: Page) {
  // Wait for loader to disappear
  await page.locator("#initial-loader").waitFor({ state: "hidden", timeout: 90000 }).catch(() => {});
  // Wait for #root to have substantive content
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#root");
      return root && root.innerHTML.length > 500;
    },
    { timeout: 90000 }
  );
  await page.waitForTimeout(2000);
}

async function snapshotDropdowns(page: Page) {
  return page.evaluate(() => {
    const result: Record<string, unknown> = {};

    result.selects = Array.from(document.querySelectorAll("select")).map((el, i) => ({
      index: i,
      id: el.id,
      name: el.getAttribute("name"),
      className: el.className,
      options: Array.from(el.querySelectorAll("option")).map((o) => ({
        value: o.value,
        text: o.textContent?.trim(),
      })),
    }));

    // React-select / custom dropdown patterns
    const customSelectors = [
      ".select__control",
      ".react-select",
      "[class*='Select']",
      "[class*='select']",
      "[class*='dropdown']",
      "[class*='Dropdown']",
    ];
    result.customDropdowns = customSelectors.flatMap((sel) =>
      Array.from(document.querySelectorAll(sel))
        .slice(0, 10)
        .map((el) => ({
          selector: sel,
          tag: el.tagName,
          id: el.id || null,
          className: el.className?.toString().slice(0, 150) ?? null,
          text: (el.textContent ?? "").trim().slice(0, 100),
        }))
    );

    result.ariaDropdowns = Array.from(
      document.querySelectorAll(
        '[role="combobox"], [role="listbox"], [aria-haspopup="listbox"], [aria-haspopup="true"], [role="button"][aria-expanded]'
      )
    ).map((el) => ({
      tag: el.tagName,
      id: el.id || null,
      className: el.className?.toString().slice(0, 150) ?? null,
      role: el.getAttribute("role"),
      ariaLabel: el.getAttribute("aria-label"),
      ariaExpanded: el.getAttribute("aria-expanded"),
      text: (el.textContent ?? "").trim().slice(0, 100),
    }));

    // All visible labels on page
    result.labels = Array.from(document.querySelectorAll("label, .form-label, [class*='label']"))
      .filter((el) => (el.textContent ?? "").trim().length > 0 && (el.textContent ?? "").trim().length < 50)
      .slice(0, 30)
      .map((el) => ({
        tag: el.tagName,
        for: el.getAttribute("for"),
        className: el.className?.toString().slice(0, 80) ?? null,
        text: el.textContent?.trim(),
      }));

    // Form groups / filter sections
    result.formGroups = Array.from(document.querySelectorAll(".form-group, .mb-3, .col, [class*='filter']"))
      .filter((el) => (el.textContent ?? "").length < 200)
      .slice(0, 20)
      .map((el) => ({
        className: el.className?.toString().slice(0, 100) ?? null,
        text: (el.textContent ?? "").trim().slice(0, 120),
        childTags: Array.from(el.children).map((c) => c.tagName).join(","),
      }));

    // Download links
    result.downloadLinks = Array.from(document.querySelectorAll("a, button"))
      .filter((el) => /csv|download|export/i.test((el.textContent ?? "") + (el.getAttribute("href") ?? "")))
      .map((el) => ({
        tag: el.tagName,
        href: el.getAttribute("href"),
        text: (el.textContent ?? "").trim().slice(0, 80),
        className: el.className?.toString().slice(0, 80) ?? null,
      }));

    return result;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 150 : 0 });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    userAgent: "CollectorApp-ChecklistHarvest/1.0 (+internal research)",
  });

  console.log("Navigating to", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await dismissModals(page);
  console.log("Waiting for React app...");
  await waitForApp(page);
  await dismissModals(page);

  let snapshot = await snapshotDropdowns(page);
  console.log("\n=== AFTER APP LOAD ===");
  console.log(JSON.stringify(snapshot, null, 2));

  // Save root HTML for offline analysis
  const rootHtml = await page.locator("#root").innerHTML();
  writeFileSync(join(OUT_DIR, "root-html.html"), rootHtml);
  console.log(`\nSaved #root HTML (${rootHtml.length} chars) to probe-output/root-html.html`);

  // Try to find and interact with sport dropdown
  // Common patterns: react-select, native select, custom div dropdowns
  const sportTriggers = [
    page.locator("select").first(),
    page.locator(".select__control").first(),
    page.locator('[class*="select"]').filter({ hasText: /sport|select/i }).first(),
    page.getByText("Select Sport", { exact: false }),
    page.locator("label").filter({ hasText: /sport/i }).locator("..").locator("select, [role='combobox'], .select__control").first(),
  ];

  for (const trigger of sportTriggers) {
    if ((await trigger.count()) === 0) continue;
    if (!(await trigger.isVisible().catch(() => false))) continue;
    console.log("\nTrying sport trigger:", await trigger.evaluate((el) => el.outerHTML.slice(0, 200)));
    try {
      await trigger.click({ timeout: 5000 });
      await page.waitForTimeout(1000);

      const options = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            'option, [role="option"], .select__option, [class*="option"], .dropdown-item, li'
          )
        )
          .filter((el) => (el.textContent ?? "").trim().length > 0 && (el.textContent ?? "").trim().length < 60)
          .slice(0, 40)
          .map((el) => ({
            tag: el.tagName,
            role: el.getAttribute("role"),
            className: el.className?.toString().slice(0, 100) ?? null,
            text: (el.textContent ?? "").trim(),
          }))
      );
      console.log("Options visible:", JSON.stringify(options, null, 2));

      // Click Basketball
      const basketball = page.getByRole("option", { name: "Basketball" })
        .or(page.locator(".select__option, [role='option'], li, option").filter({ hasText: /^Basketball$/i }))
        .first();
      if (await basketball.count() > 0) {
        await basketball.click();
        await page.waitForTimeout(2000);
        console.log("Selected Basketball");
        snapshot = await snapshotDropdowns(page);
        console.log("\n=== AFTER BASKETBALL ===");
        console.log(JSON.stringify(snapshot, null, 2));

        const rootHtml2 = await page.locator("#root").innerHTML();
        writeFileSync(join(OUT_DIR, "root-after-basketball.html"), rootHtml2);
      }
      break;
    } catch (e) {
      console.log("Trigger failed:", e);
    }
  }

  if (HEADED) {
    console.log("\nHeaded mode: pausing 15s...");
    await page.waitForTimeout(15000);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
