import type { Asset } from "@/types/asset";
import type { MarketListing, MarketListingType } from "@/types/market-sales";
import type { EbayItemSummary } from "@/lib/ebay/browse-client";
import { parseListingGradeFromTitle } from "@/lib/ebay/grade-parser";
import { scoreEbayListingMatchConfidence } from "@/lib/ebay/match-confidence";

function parsePrice(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveListingType(item: EbayItemSummary): MarketListingType {
  const options = item.buyingOptions ?? [];
  if (options.includes("AUCTION") && !options.includes("FIXED_PRICE")) {
    return "auction";
  }
  if (options.includes("FIXED_PRICE") && !options.includes("AUCTION")) {
    return "buy_it_now";
  }
  if (options.includes("AUCTION")) {
    return "auction";
  }
  return "buy_it_now";
}

function resolveListingPrice(
  item: EbayItemSummary,
  listingType: MarketListingType
): number {
  if (listingType === "auction") {
    return (
      parsePrice(item.currentBidPrice?.value) ??
      parsePrice(item.price?.value) ??
      0
    );
  }

  return parsePrice(item.price?.value) ?? 0;
}

function resolveListingUrl(item: EbayItemSummary): string {
  if (item.itemWebUrl) return item.itemWebUrl;

  const legacyId = item.itemId.split("|")[1];
  if (legacyId) {
    return `https://www.ebay.com/itm/${legacyId}`;
  }

  return `https://www.ebay.com/itm/${item.itemId}`;
}

export function mapEbayItemSummaryToMarketListing(
  asset: Asset,
  item: EbayItemSummary
): MarketListing | null {
  if (!item.itemId || !item.title) return null;

  const listingType = resolveListingType(item);
  const price = resolveListingPrice(item, listingType);
  if (price <= 0) return null;

  const parsedGrade = parseListingGradeFromTitle(item.title);

  return {
    id: item.itemId,
    source: "ebay",
    title: item.title,
    grader: parsedGrade.grader,
    grade: parsedGrade.grade,
    listing_type: listingType,
    price,
    bid_count: listingType === "auction" ? (item.bidCount ?? 0) : null,
    ends_at: item.itemEndDate ?? new Date(Date.now() + 86_400_000).toISOString(),
    listing_url: resolveListingUrl(item),
    match_confidence: scoreEbayListingMatchConfidence(asset, item.title),
    currency: "USD",
  };
}

export function mapEbayItemSummariesToMarketListings(
  asset: Asset,
  items: EbayItemSummary[]
): MarketListing[] {
  const byId = new Map<string, MarketListing>();

  for (const item of items) {
    const listing = mapEbayItemSummaryToMarketListing(asset, item);
    if (!listing) continue;
    byId.set(listing.id, listing);
  }

  return [...byId.values()].sort((a, b) => a.ends_at.localeCompare(b.ends_at));
}
