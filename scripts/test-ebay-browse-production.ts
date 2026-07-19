import { readFileSync } from "fs";
import { resolve } from "path";
import { getEbayApplicationAccessToken } from "../src/lib/ebay/auth";
import { getEbayEnvironment } from "../src/lib/ebay/config";
import { searchEbayListingsForQuery } from "../src/lib/ebay/browse-client";

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
  const env = getEbayEnvironment();
  console.log("Environment:", env);

  const token = await getEbayApplicationAccessToken(env);
  console.log("OAuth OK, token length:", token.length);

  const results = await searchEbayListingsForQuery({
    q: "2000 Bowman Tom Brady",
    categoryIds: "261328",
    filter: "buyingOptions:{FIXED_PRICE|AUCTION}",
    sort: "endingSoonest",
    limit: 5,
  });

  console.log("Browse results:", results.length);
  for (const item of results.slice(0, 3)) {
    console.log("-", item.title?.slice(0, 60), item.price?.value);
  }
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
