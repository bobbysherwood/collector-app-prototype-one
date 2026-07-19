/**
 * Probe eBay Browse API for each held asset on an account.
 *
 * Usage:
 *   npx tsx scripts/probe-ebay-holdings.ts
 *   npx tsx scripts/probe-ebay-holdings.ts --display-name "Bobby Sherwood"
 *
 * Requires in .env.local (or environment):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_ENV
 *   PROBE_EMAIL, PROBE_PASSWORD  (account to sign in as)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

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

const SPORTS_TRADING_CARD_SINGLES = "261328";
const CCG_INDIVIDUAL_CARDS = "183454";
const EBAY_BROWSE_SCOPE = "https://api.ebay.com/oauth/api_scope/buy.browse";
const EBAY_APPLICATION_SCOPE = "https://api.ebay.com/oauth/api_scope";

interface AssetRow {
  id: string;
  player_name: string;
  year: number;
  card_type: string;
  sport: string;
  card_number: string | null;
  insert_parallel: string | null;
}

function buildQuery(asset: AssetRow) {
  const terms = [
    String(asset.year),
    asset.card_type.trim(),
    asset.player_name.trim(),
  ];
  if (asset.insert_parallel?.trim()) terms.push(asset.insert_parallel.trim());
  if (asset.card_number?.trim()) terms.push(`#${asset.card_number.trim()}`);

  return {
    q: terms.filter(Boolean).join(" "),
    categoryIds:
      asset.sport === "Pokemon" ? CCG_INDIVIDUAL_CARDS : SPORTS_TRADING_CARD_SINGLES,
    filter: "buyingOptions:{AUCTION|FIXED_PRICE}",
    sort: "endingSoonest",
    limit: 50,
  };
}

function cardTitle(asset: AssetRow) {
  return `${asset.year} ${asset.card_type} ${asset.player_name}`;
}

async function getEbayToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET");
  }

  const env = process.env.EBAY_ENV?.trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
  const base =
    env === "production"
      ? "https://api.ebay.com"
      : "https://api.sandbox.ebay.com";
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  for (const scope of [EBAY_BROWSE_SCOPE, EBAY_APPLICATION_SCOPE]) {
    const response = await fetch(`${base}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { access_token: string };
      return data.access_token;
    }

    const body = await response.text();
    if (!body.includes("invalid_scope")) {
      throw new Error(`eBay OAuth failed (${response.status}): ${body}`);
    }
  }

  throw new Error("eBay OAuth failed: no valid scope");
}

async function searchEbay(
  token: string,
  query: ReturnType<typeof buildQuery>
): Promise<{ total: number; sampleTitle: string | null }> {
  const env = process.env.EBAY_ENV?.trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
  const base =
    env === "production"
      ? "https://api.ebay.com"
      : "https://api.sandbox.ebay.com";

  const params = new URLSearchParams({
    q: query.q,
    category_ids: query.categoryIds,
    filter: query.filter,
    sort: query.sort,
    limit: "5",
    offset: "0",
  });

  const response = await fetch(
    `${base}/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Browse search failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    total?: number;
    itemSummaries?: { title?: string }[];
  };

  return {
    total: data.total ?? 0,
    sampleTitle: data.itemSummaries?.[0]?.title ?? null,
  };
}

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.PROBE_EMAIL?.trim() || parseArg("--email");
  const password = process.env.PROBE_PASSWORD?.trim() || parseArg("--password");
  const displayNameFilter =
    parseArg("--display-name") || "Bobby Sherwood";

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!email || !password) {
    throw new Error(
      "Missing PROBE_EMAIL / PROBE_PASSWORD in .env.local or --email / --password args"
    );
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
  if (!user) throw new Error("No authenticated user");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (
    displayNameFilter &&
    profile?.display_name &&
    profile.display_name !== displayNameFilter
  ) {
    console.warn(
      `Warning: signed in as "${profile.display_name}" (${profile.email}), not "${displayNameFilter}"`
    );
  }

  const { data: lots, error: lotsError } = await supabase
    .from("lots")
    .select("asset_id")
    .eq("user_id", user.id)
    .gt("quantity_remaining", 0);

  if (lotsError) throw new Error(`Lots query failed: ${lotsError.message}`);

  const assetIds = [...new Set((lots ?? []).map((l) => l.asset_id))];
  if (assetIds.length === 0) {
    console.log("No held assets found.");
    return;
  }

  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .select(
      "id, player_name, year, card_type, sport, card_number, insert_parallel"
    )
    .in("id", assetIds)
    .order("year", { ascending: false });

  if (assetsError) throw new Error(`Assets query failed: ${assetsError.message}`);

  const token = await getEbayToken();
  const ebayEnv = process.env.EBAY_ENV?.trim() || "sandbox";

  console.log(
    `\nAccount: ${profile?.display_name ?? user.id} (${profile?.email ?? email})`
  );
  console.log(`Held assets: ${assets?.length ?? 0} | eBay env: ${ebayEnv}\n`);

  type ResultRow = {
    title: string;
    id: string;
    query: string;
    total: number;
    sample: string | null;
    path: string;
  };

  const withResults: ResultRow[] = [];
  const rows: ResultRow[] = [];

  for (const asset of assets ?? []) {
    const query = buildQuery(asset as AssetRow);
    try {
      const { total, sampleTitle } = await searchEbay(token, query);
      const row = {
        title: cardTitle(asset as AssetRow),
        id: asset.id,
        query: query.q,
        total,
        sample: sampleTitle,
        path: `/cards/${asset.id}`,
      };
      rows.push(row);
      if (total > 0) withResults.push(row);
    } catch (error) {
      rows.push({
        title: cardTitle(asset as AssetRow),
        id: asset.id,
        query: query.q,
        total: -1,
        sample:
          error instanceof Error ? error.message.slice(0, 80) : "search error",
        path: `/cards/${asset.id}`,
      });
    }
  }

  console.log("--- ALL HOLDINGS ---");
  console.table(
    rows.map((r) => ({
      title: r.title,
      total: r.total,
      query: r.query,
      path: r.path,
    }))
  );

  console.log("\n--- WITH eBay RESULTS (confirm in UI) ---");
  if (withResults.length === 0) {
    console.log(
      "None returned listings. Sandbox often has zero inventory; try EBAY_ENV=production for real data."
    );
  } else {
    console.table(
      withResults.map((r) => ({
        title: r.title,
        total: r.total,
        sample: r.sample,
        path: r.path,
      }))
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
