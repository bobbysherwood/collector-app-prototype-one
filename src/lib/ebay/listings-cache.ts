import { createClient } from "@/lib/supabase/server";
import { getEbayEnvironment, type EbayEnvironment } from "@/lib/ebay/config";
import type { MarketListing } from "@/types/market-sales";

/** Calendar day boundary for cache freshness (not a rolling 24h window). */
const LISTINGS_CACHE_TIMEZONE =
  process.env.EBAY_LISTINGS_CACHE_TIMEZONE?.trim() || "America/New_York";

const CACHE_QUERY_ENV_PREFIX = /^env:(sandbox|production)\|/;

interface EbayListingsCacheRow {
  asset_id: string;
  listings: MarketListing[];
  search_query: string;
  result_count: number;
  fetched_at: string;
}

export interface CachedEbayListings {
  listings: MarketListing[];
  searchQuery: string;
  fetchedAt: string;
  fromCache: boolean;
}

export function formatCachedSearchQuery(
  searchQuery: string,
  env: EbayEnvironment = getEbayEnvironment()
): string {
  return `env:${env}|${searchQuery}`;
}

export function parseCachedSearchQuery(stored: string): {
  env: EbayEnvironment | null;
  searchQuery: string;
} {
  const match = stored.match(CACHE_QUERY_ENV_PREFIX);
  if (!match) {
    return { env: null, searchQuery: stored };
  }
  return {
    env: match[1] as EbayEnvironment,
    searchQuery: stored.slice(match[0].length),
  };
}

export function isCachedSearchQueryForCurrentEnv(stored: string): boolean {
  const { env } = parseCachedSearchQuery(stored);
  if (!env) return false;
  return env === getEbayEnvironment();
}

/** YYYY-MM-DD in the configured timezone. */
export function calendarDayKey(
  date: Date,
  timeZone = LISTINGS_CACHE_TIMEZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isListingsCacheFreshForToday(
  fetchedAt: string | Date,
  now = new Date(),
  timeZone = LISTINGS_CACHE_TIMEZONE
): boolean {
  const fetched =
    typeof fetchedAt === "string" ? new Date(fetchedAt) : fetchedAt;
  if (Number.isNaN(fetched.getTime())) return false;
  return calendarDayKey(fetched, timeZone) === calendarDayKey(now, timeZone);
}

export async function getCachedEbayListings(
  assetId: string
): Promise<CachedEbayListings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebay_listings_cache")
    .select("asset_id, listings, search_query, result_count, fetched_at")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (error) {
    console.error("Failed to read eBay listings cache:", error.message);
    return null;
  }

  if (!data) return null;

  if (!isListingsCacheFreshForToday(data.fetched_at)) {
    return null;
  }

  if (!isCachedSearchQueryForCurrentEnv(data.search_query)) {
    return null;
  }

  const listings = (data.listings ?? []) as MarketListing[];
  const { searchQuery } = parseCachedSearchQuery(data.search_query);

  return {
    listings,
    searchQuery,
    fetchedAt: data.fetched_at,
    fromCache: true,
  };
}

export async function upsertCachedEbayListings(input: {
  assetId: string;
  listings: MarketListing[];
  searchQuery: string;
}): Promise<string | null> {
  const supabase = await createClient();
  const fetchedAt = new Date().toISOString();
  const { error } = await supabase.from("ebay_listings_cache").upsert(
    {
      asset_id: input.assetId,
      listings: input.listings,
      search_query: formatCachedSearchQuery(input.searchQuery),
      result_count: input.listings.length,
      fetched_at: fetchedAt,
    },
    { onConflict: "asset_id" }
  );

  if (error) {
    console.error("Failed to write eBay listings cache:", error.message);
    return null;
  }

  return fetchedAt;
}
