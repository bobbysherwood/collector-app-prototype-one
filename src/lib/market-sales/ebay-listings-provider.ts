import type { Asset } from "@/types/asset";
import type { MarketListing } from "@/types/market-sales";
import { searchEbayListingsForQuery } from "@/lib/ebay/browse-client";
import { getEbayEnvironment, isEbayConfigured } from "@/lib/ebay/config";
import {
  getCachedEbayListings,
  upsertCachedEbayListings,
} from "@/lib/ebay/listings-cache";
import { mapEbayItemSummariesToMarketListings } from "@/lib/ebay/listing-mapper";
import { buildEbayListingSearchQuery } from "@/lib/ebay/query-builder";
import { fetchSandboxListingsViaSellBridge } from "@/lib/ebay/sandbox-bridge";

export interface EbayListingsFetchResult {
  listings: MarketListing[];
  as_of: string | null;
  search_query: string | null;
  from_cache: boolean;
  sandbox_mode: boolean;
  error?: string;
}

export async function getEbayListingsForAsset(
  asset: Asset
): Promise<EbayListingsFetchResult> {
  const sandboxMode = getEbayEnvironment() === "sandbox";

  const cached = await getCachedEbayListings(asset.id);
  if (cached) {
    return {
      listings: cached.listings,
      as_of: cached.fetchedAt,
      search_query: cached.searchQuery,
      from_cache: true,
      sandbox_mode: sandboxMode,
    };
  }

  if (!isEbayConfigured()) {
    return {
      listings: [],
      as_of: null,
      search_query: null,
      from_cache: false,
      sandbox_mode: sandboxMode,
      error: "eBay integration is not configured.",
    };
  }

  const searchQuery = buildEbayListingSearchQuery(asset);

  try {
    let summaries = await searchEbayListingsForQuery(searchQuery);

    if (sandboxMode && summaries.length === 0) {
      const bridgeSummaries = await fetchSandboxListingsViaSellBridge(asset);
      summaries = bridgeSummaries;
    }

    const listings = mapEbayItemSummariesToMarketListings(asset, summaries);
    const fetchedAt =
      (await upsertCachedEbayListings({
        assetId: asset.id,
        listings,
        searchQuery: searchQuery.q,
      })) ?? new Date().toISOString();

    if (sandboxMode && listings.length === 0) {
      if (!process.env.EBAY_USER_REFRESH_TOKEN?.trim()) {
        return {
          listings: [],
          as_of: null,
          search_query: searchQuery.q,
          from_cache: false,
          sandbox_mode: sandboxMode,
          error:
            "EBAY_USER_REFRESH_TOKEN is not set. Sandbox Browse search does not return results; add a seller refresh token (npm run ebay:seller-auth) to load seeded test listings.",
        };
      }
    }

    return {
      listings,
      as_of: fetchedAt,
      search_query: searchQuery.q,
      from_cache: false,
      sandbox_mode: sandboxMode,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load eBay listings.";
    console.error("eBay listings fetch failed:", message);

    return {
      listings: [],
      as_of: null,
      search_query: searchQuery.q,
      from_cache: false,
      sandbox_mode: sandboxMode,
      error: message,
    };
  }
}
