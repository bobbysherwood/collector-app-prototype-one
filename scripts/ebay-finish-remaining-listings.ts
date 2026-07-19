import { readFileSync } from "fs";
import { resolve } from "path";
import { getEbayUserAccessToken, getEbayEnvironmentFromEnv } from "../src/lib/ebay/seller-auth";
import {
  createAndPublishBinListing,
  buildCollectorAppListingSku,
  ensureSellPolicies,
} from "../src/lib/ebay/sell-api";

function loadEnvLocal() {
  const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const REMAINING = [
  {
    assetId: "22b01392-4dbc-42d5-997b-e62f5357b4a4",
    title: "1989 Other Ken Griffey Jr. Classic Travel Update I #131",
    basePrice: 213,
  },
  {
    assetId: "e863966e-aee5-473c-a5be-d1756319fa33",
    title: "1997 Z-Force Michael Jordan Quick Strike #5",
    basePrice: 1975,
  },
];

function randomMarkupPrice(base: number): number {
  const markup = 1 + (0.1 + Math.random() * 0.2);
  return Math.round(base * markup * 100) / 100;
}

async function main() {
  loadEnvLocal();
  const env = getEbayEnvironmentFromEnv();
  const accessToken = await getEbayUserAccessToken(env);
  const policies = await ensureSellPolicies(accessToken, env);
  const imageUrls = [
    "https://i.ebayimg.com/images/g/V4sAAOSw~Epc~J5L/s-l1600.jpg",
  ];

  let published = 0;
  let failed = 0;

  for (const card of REMAINING) {
    for (let index = 1; index <= 3; index++) {
      const sku = buildCollectorAppListingSku(card.assetId, index);
      const priceUsd = randomMarkupPrice(card.basePrice);
      const title = `${card.title} (Test BIN ${index})`;
      try {
        const created = await createAndPublishBinListing(
          accessToken,
          policies,
          {
            sku,
            title,
            description: `Test Buy It Now listing for ${card.title}.`,
            priceUsd,
            imageUrls,
          },
          env
        );
        published++;
        console.log(`✓ ${title} @ $${priceUsd} → listing ${created.listingId}`);
      } catch (error) {
        failed++;
        console.error(
          `✗ ${title}:`,
          error instanceof Error ? error.message.slice(0, 150) : error
        );
      }
    }
  }

  console.log(`\nRemaining cards: ${published} published, ${failed} failed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
