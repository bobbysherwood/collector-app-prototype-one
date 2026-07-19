import { readFileSync } from "fs";
import { resolve } from "path";
import { getEbayUserAccessToken } from "../src/lib/ebay/seller-auth";
import { getOffersBySku, buildCollectorAppListingSku } from "../src/lib/ebay/sell-api";
import { fetchSandboxListingsViaSellBridge } from "../src/lib/ebay/sandbox-bridge";

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
  const token = await getEbayUserAccessToken("sandbox");
  console.log("Token OK, length:", token.length);

  for (const assetId of [
    "fa6edcca-8d8d-4316-be12-10a716a2c478",
    "707885a4-8008-49a8-9061-aa4ac4020eb5",
  ]) {
    const sku = buildCollectorAppListingSku(assetId, 1);
    try {
      const offers = await getOffersBySku(token, sku, "sandbox");
      console.log(assetId.slice(0, 8), sku, "offers:", offers.length, offers);
    } catch (error) {
      console.log(assetId.slice(0, 8), sku, "ERROR:", (error as Error).message.slice(0, 120));
    }
  }

  const bridge = await fetchSandboxListingsViaSellBridge({
    id: "707885a4-8008-49a8-9061-aa4ac4020eb5",
    player_name: "Tom Brady",
    year: 2000,
    card_type: "Bowman",
    sport: "Football",
    card_number: "236",
    insert_parallel: null,
    image_path: null,
    notes: null,
    user_id: "",
    created_at: "",
    updated_at: "",
  });
  console.log("Tom Brady bridge listings:", bridge.length);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
