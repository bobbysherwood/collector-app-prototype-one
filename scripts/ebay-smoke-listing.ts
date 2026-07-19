import { readFileSync } from "fs";
import { resolve } from "path";
import { getEbayUserAccessToken, getEbayEnvironmentFromEnv } from "../src/lib/ebay/seller-auth";
import {
  createAndPublishBinListing,
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

async function main() {
  loadEnvLocal();
  const env = getEbayEnvironmentFromEnv();
  const accessToken = await getEbayUserAccessToken(env);
  const policies = await ensureSellPolicies(accessToken, env);
  const created = await createAndPublishBinListing(
    accessToken,
    policies,
    {
      sku: "cp-smoketest-1",
      title: "Collector App Smoke Test BIN",
      description: "Single listing smoke test.",
      priceUsd: 19.99,
      imageUrls: [
        "https://i.ebayimg.com/images/g/V4sAAOSw~Epc~J5L/s-l1600.jpg",
      ],
    },
    env
  );
  console.log("Smoke test OK:", created);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
