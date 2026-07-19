import { readFileSync } from "fs";
import { resolve } from "path";
import { getEbayApplicationAccessToken } from "../src/lib/ebay/auth";
import { searchEbayListingsForQuery } from "../src/lib/ebay/browse-client";
import { mapEbayItemSummariesToMarketListings } from "../src/lib/ebay/listing-mapper";
import { buildEbayListingSearchQuery } from "../src/lib/ebay/query-builder";
import type { Asset } from "../src/types/asset";

function loadEnvLocal() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const brady: Asset = {
  id: "707885a4-8008-49a8-9061-aa4ac4020eb5",
  user_id: "test",
  year: 2000,
  card_type: "Bowman",
  player_name: "Tom Brady",
  sport: "Football",
  card_number: "236",
  insert_parallel: null,
  image_path: null,
  created_at: "",
  updated_at: "",
};

async function main() {
  loadEnvLocal();
  await getEbayApplicationAccessToken("production");
  const q = buildEbayListingSearchQuery(brady);
  console.log("query:", q.q);

  const summaries = await searchEbayListingsForQuery(q);
  console.log("summaries:", summaries.length);

  let noPrice = 0;
  for (const s of summaries.slice(0, 5)) {
    console.log("\n--- item ---");
    console.log("title:", s.title?.slice(0, 70));
    console.log("price:", s.price);
    console.log("currentBidPrice:", s.currentBidPrice);
    console.log("buyingOptions:", s.buyingOptions);
    if (!s.price?.value && !s.currentBidPrice?.value) noPrice++;
  }

  const listings = mapEbayItemSummariesToMarketListings(brady, summaries);
  console.log("\nmapped listings:", listings.length);
  console.log("items missing price in first 5:", noPrice);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
