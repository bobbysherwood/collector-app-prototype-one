/**
 * Create sandbox/production Buy It Now eBay listings for held portfolio cards.
 *
 * Usage:
 *   npx tsx scripts/create-ebay-sandbox-listings.ts
 *   npx tsx scripts/create-ebay-sandbox-listings.ts --dry-run
 *
 * Requires .env.local:
 *   EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_ENV
 *   EBAY_USER_REFRESH_TOKEN  (from scripts/ebay-seller-auth.ts)
 *   EBAY_RUNAME              (for initial auth only)
 *   PROBE_EMAIL, PROBE_PASSWORD (portfolio account to read cards/values)
 *
 * Optional:
 *   EBAY_PAYMENT_POLICY_ID, EBAY_FULFILLMENT_POLICY_ID, EBAY_RETURN_POLICY_ID
 *   EBAY_MERCHANT_LOCATION_KEY
 *   LISTINGS_PER_CARD=3
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getEbayUserAccessToken, getEbayEnvironmentFromEnv } from "../src/lib/ebay/seller-auth";
import {
  createAndPublishBinListing,
  buildCollectorAppListingSku,
  ensureSellPolicies,
} from "../src/lib/ebay/sell-api";

function loadEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const contents = readFileSync(envPath, "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const LISTINGS_PER_CARD = Number(process.env.LISTINGS_PER_CARD ?? "3") || 3;
const SPORTS_TRADING_CARD_SINGLES = "261328";
const CCG_INDIVIDUAL_CARDS = "183454";
const PLACEHOLDER_IMAGE =
  "https://i.ebayimg.com/images/g/V4sAAOSw~Epc~J5L/s-l1600.jpg";

interface AssetRow {
  id: string;
  player_name: string;
  year: number;
  card_type: string;
  sport: string;
  card_number: string | null;
  insert_parallel: string | null;
  image_path: string | null;
}

interface LotRow {
  id: string;
  asset_id: string;
  unit_cost: number;
  quantity_remaining: number;
  grader: string;
  grade: string | null;
}

interface ValuationRow {
  lot_id: string;
  value: number;
  recorded_at: string;
}

function cardTitle(asset: AssetRow): string {
  const parts = [
    String(asset.year),
    asset.card_type,
    asset.player_name,
  ];
  if (asset.insert_parallel?.trim()) parts.push(asset.insert_parallel.trim());
  if (asset.card_number?.trim()) parts.push(`#${asset.card_number.trim()}`);
  return parts.filter(Boolean).join(" ");
}

function getImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/card-images/${imagePath}`;
}

function randomMarkupPrice(base: number): number {
  const markup = 0.1 + Math.random() * 0.2;
  return Math.round(base * (1 + markup) * 100) / 100;
}

function latestValuationForLots(
  lotIds: string[],
  valuations: ValuationRow[]
): number | null {
  let best: ValuationRow | null = null;
  for (const valuation of valuations) {
    if (!lotIds.includes(valuation.lot_id)) continue;
    if (
      !best ||
      new Date(valuation.recorded_at).getTime() >
        new Date(best.recorded_at).getTime()
    ) {
      best = valuation;
    }
  }
  return best ? Number(best.value) : null;
}

function basePriceForAsset(
  heldLots: LotRow[],
  valuations: ValuationRow[]
): number {
  const lotIds = heldLots.map((lot) => lot.id);
  const latestValue = latestValuationForLots(lotIds, valuations);
  if (latestValue != null && latestValue > 0) return latestValue;

  const costs = heldLots
    .map((lot) => Number(lot.unit_cost))
    .filter((cost) => cost > 0);
  if (costs.length === 0) return 25;
  return costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
}

function categoryForSport(sport: string): string {
  return sport === "Pokemon" ? CCG_INDIVIDUAL_CARDS : SPORTS_TRADING_CARD_SINGLES;
}

function buildSku(assetId: string, index: number): string {
  return buildCollectorAppListingSku(assetId, index);
}

async function loadPortfolio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.PROBE_EMAIL?.trim();
  const password = process.env.PROBE_PASSWORD?.trim();

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  if (!email || !password) {
    throw new Error("Missing PROBE_EMAIL / PROBE_PASSWORD.");
  }

  const supabase = createClient(url, anonKey);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(`Sign in failed: ${signInError.message}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No authenticated user.");

  const { data: lots, error: lotsError } = await supabase
    .from("lots")
    .select("id, asset_id, unit_cost, quantity_remaining, grader, grade")
    .eq("user_id", user.id)
    .gt("quantity_remaining", 0);

  if (lotsError) throw new Error(lotsError.message);

  const heldLots = (lots ?? []) as LotRow[];
  const assetIds = [...new Set(heldLots.map((lot) => lot.asset_id))];

  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .select(
      "id, player_name, year, card_type, sport, card_number, insert_parallel, image_path"
    )
    .in("id", assetIds);

  if (assetsError) throw new Error(assetsError.message);

  const lotIds = heldLots.map((lot) => lot.id);
  const { data: valuations, error: valuationsError } = await supabase
    .from("card_valuations")
    .select("lot_id, value, recorded_at")
    .in("lot_id", lotIds);

  if (valuationsError) throw new Error(valuationsError.message);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  return {
    profile,
    assets: (assets ?? []) as AssetRow[],
    heldLots,
    valuations: (valuations ?? []) as ValuationRow[],
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = getEbayEnvironmentFromEnv();
  const { profile, assets, heldLots, valuations } = await loadPortfolio();

  console.log(
    `Account: ${profile?.display_name ?? "unknown"} (${profile?.email ?? ""})`
  );
  console.log(`Held cards: ${assets.length} | Listings per card: ${LISTINGS_PER_CARD}`);
  console.log(`eBay env: ${env}${dryRun ? " | DRY RUN" : ""}\n`);

  const plan: {
    assetId: string;
    title: string;
    basePrice: number;
    listings: { sku: string; price: number; title: string }[];
  }[] = [];

  for (const asset of assets) {
    const lotsForAsset = heldLots.filter((lot) => lot.asset_id === asset.id);
    const basePrice = basePriceForAsset(lotsForAsset, valuations);
    const title = cardTitle(asset);
    const listings = Array.from({ length: LISTINGS_PER_CARD }, (_, index) => ({
      sku: buildSku(asset.id, index + 1),
      price: randomMarkupPrice(basePrice),
      title: `${title} (Test BIN ${index + 1})`,
    }));

    plan.push({ assetId: asset.id, title, basePrice, listings });
  }

  console.table(
    plan.map((item) => ({
      card: item.title,
      base: item.basePrice.toFixed(2),
      prices: item.listings.map((l) => l.price.toFixed(2)).join(", "),
      path: `/cards/${item.assetId}`,
    }))
  );

  if (dryRun) {
    console.log(`\nDry run only — would create ${plan.length * LISTINGS_PER_CARD} listings.`);
    return;
  }

  const accessToken = await getEbayUserAccessToken(env);
  const policies = await ensureSellPolicies(accessToken, env);

  const results: {
    card: string;
    sku: string;
    price: number;
    offerId: string;
    listingId?: string;
    error?: string;
  }[] = [];

  for (const item of plan) {
    const asset = assets.find((row) => row.id === item.assetId)!;
    const imageUrl = getImageUrl(asset.image_path);
    const imageUrls = imageUrl ? [imageUrl] : [PLACEHOLDER_IMAGE];
    const description = `Test Buy It Now listing for ${item.title}. Generated by Collector App sandbox seeding.`;

    for (const listing of item.listings) {
      try {
        const created = await createAndPublishBinListing(
          accessToken,
          policies,
          {
            sku: listing.sku,
            title: listing.title,
            description,
            priceUsd: listing.price,
            imageUrls,
            categoryId: categoryForSport(asset.sport),
          },
          env
        );

        results.push({
          card: item.title,
          sku: listing.sku,
          price: listing.price,
          offerId: created.offerId,
          listingId: created.listingId,
        });
        console.log(
          `✓ ${listing.title} @ $${listing.price.toFixed(2)} → offer ${created.offerId}${created.listingId ? ` / listing ${created.listingId}` : ""}`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown listing error";
        results.push({
          card: item.title,
          sku: listing.sku,
          price: listing.price,
          offerId: "",
          error: message.slice(0, 200),
        });
        console.error(`✗ ${listing.title}: ${message.slice(0, 200)}`);
      }
    }
  }

  const succeeded = results.filter((row) => !row.error);
  const failed = results.filter((row) => row.error);

  console.log(`\nDone: ${succeeded.length} published, ${failed.length} failed.`);
  if (succeeded.length > 0) {
    console.log(
      "Reload card pages to see listings (fetched fresh on each open)."
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
