import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEbayListingsForAsset } from "@/lib/market-sales/ebay-listings-provider";
import { buildEbayListingSearchQuery } from "@/lib/ebay/query-builder";
import type { Asset } from "@/types/asset";
import { cardTitle } from "@/types/card";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required. Open /login first, then retry this URL." },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: lots, error: lotsError } = await supabase
    .from("lots")
    .select("asset_id")
    .eq("user_id", user.id)
    .gt("quantity_remaining", 0);

  if (lotsError) {
    return NextResponse.json({ error: lotsError.message }, { status: 500 });
  }

  const assetIds = [...new Set((lots ?? []).map((l) => l.asset_id))];
  if (assetIds.length === 0) {
    return NextResponse.json({
      account: profile,
      heldCount: 0,
      results: [],
    });
  }

  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .select("*")
    .in("id", assetIds)
    .order("year", { ascending: false });

  if (assetsError) {
    return NextResponse.json({ error: assetsError.message }, { status: 500 });
  }

  const results = await Promise.all(
    (assets as Asset[]).map(async (asset) => {
      const searchQuery = buildEbayListingSearchQuery(asset);
      const ebay = await getEbayListingsForAsset(asset);
      return {
        title: cardTitle(asset),
        assetId: asset.id,
        path: `/cards/${asset.id}`,
        searchQuery: searchQuery.q,
        listingCount: ebay.listings.length,
        sampleListingTitle: ebay.listings[0]?.title ?? null,
        fromCache: ebay.from_cache,
        error: ebay.error ?? null,
      };
    })
  );

  const withResults = results.filter((r) => r.listingCount > 0 && !r.error);

  return NextResponse.json({
    account: profile,
    ebayEnv: process.env.EBAY_ENV ?? "sandbox",
    heldCount: results.length,
    withResultsCount: withResults.length,
    withResults,
    all: results,
  });
}
