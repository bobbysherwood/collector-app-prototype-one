import type { Asset, Lot } from "@/types/asset";
import type {
  MarketListing,
  MarketListingType,
  MarketSaleMatchConfidence,
  MarketSaleSource,
} from "@/types/market-sales";
import { cardTitle, gradeLabel } from "@/types/card";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hoursFromNow(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function pickGradeFromLots(lots: Lot[], index: number): {
  grader: Lot["grader"];
  grade: string | null;
  confidence: MarketSaleMatchConfidence;
} {
  const heldLots = lots.filter((lot) => lot.quantity_remaining > 0);
  const pool = heldLots.length > 0 ? heldLots : lots;
  if (pool.length === 0) {
    return { grader: "PSA", grade: "10", confidence: "medium" };
  }
  const lot = pool[index % pool.length];
  return {
    grader: lot.grader,
    grade: lot.grade,
    confidence: index % 3 === 0 ? "high" : index % 3 === 1 ? "medium" : "low",
  };
}

/**
 * Deterministic mock active listings for UI development.
 */
export function getMockMarketListings(
  asset: Asset,
  lots: Lot[] = []
): MarketListing[] {
  const seed = hashString(`${asset.id}-listings`);
  const basePrice = 85 + (seed % 380);
  const title = cardTitle(asset);
  const parallelSuffix = asset.insert_parallel ? ` ${asset.insert_parallel}` : "";

  const templates: {
    source: MarketSaleSource;
    listing_type: MarketListingType;
    hoursUntilEnd: number;
    priceFactor: number;
    bidCount?: number;
  }[] = [
    { source: "ebay", listing_type: "auction", hoursUntilEnd: 6, priceFactor: 0.92, bidCount: 14 },
    { source: "ebay", listing_type: "buy_it_now", hoursUntilEnd: 72, priceFactor: 1.08 },
    { source: "fanatics_collect", listing_type: "auction", hoursUntilEnd: 28, priceFactor: 1.04, bidCount: 6 },
    { source: "ebay", listing_type: "auction", hoursUntilEnd: 52, priceFactor: 0.88, bidCount: 9 },
    { source: "fanatics_collect", listing_type: "buy_it_now", hoursUntilEnd: 120, priceFactor: 1.14 },
    { source: "ebay", listing_type: "buy_it_now", hoursUntilEnd: 36, priceFactor: 1.02 },
    { source: "fanatics_collect", listing_type: "auction", hoursUntilEnd: 4, priceFactor: 0.95, bidCount: 21 },
    { source: "ebay", listing_type: "auction", hoursUntilEnd: 18, priceFactor: 1.11, bidCount: 11 },
  ];

  return templates.map((template, index) => {
    const gradeInfo = pickGradeFromLots(lots, index + 3);
    const price = Math.round(basePrice * template.priceFactor * 100) / 100;
    const listingId = `${seed}-listing-${index}`;
    const listingUrl =
      template.source === "ebay"
        ? `https://www.ebay.com/itm/${listingId}`
        : `https://www.fanaticscollect.com/lot/${listingId}`;

    return {
      id: `mock-listing-${asset.id}-${index}`,
      source: template.source,
      title: `${title}${parallelSuffix} ${gradeLabel({
        grader: gradeInfo.grader,
        grade: gradeInfo.grade,
        cert_number: null,
      })}`,
      grader: gradeInfo.grader,
      grade: gradeInfo.grade,
      listing_type: template.listing_type,
      price,
      bid_count:
        template.listing_type === "auction" ? (template.bidCount ?? 0) : null,
      ends_at: hoursFromNow(template.hoursUntilEnd),
      listing_url: listingUrl,
      match_confidence: gradeInfo.confidence,
      currency: "USD",
    };
  });
}

export function formatListingTimeRemaining(endsAt: string, now = new Date()): string {
  const end = new Date(endsAt);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return "Ended";

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatListingEndsAt(endsAt: string): string {
  return new Date(endsAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
