import { listingGradeFilterKey } from "@/lib/ebay/grade-parser";
import {
  estimateMarketValue,
  isRecommendedBuy,
} from "@/lib/market-sales/estimate";
import type { MarketPredictionInsight } from "@/types/market-predictions";
import type { MarketListing, MarketSale } from "@/types/market-sales";

/** Listings priced more than this fraction above grade estimate trigger do-not-buy. */
export const DO_NOT_BUY_TOLERANCE = 0.15;

export type ListingBuySignal = "recommended" | "do_not_buy" | "neutral";
export type ListingValuePrediction = "up" | "down" | "flat";

export interface ListingAnalysis {
  buySignal: ListingBuySignal;
  estimatedValue: number | null;
  lastSalePrice: number | null;
  vsEstimatedPct: number | null;
  vsLastSalePct: number | null;
  vsRecentMedianPct: number | null;
  prediction: ListingValuePrediction;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function percentDiff(price: number, reference: number | null): number | null {
  if (reference == null || reference === 0) return null;
  return Math.round(((price - reference) / reference) * 1000) / 10;
}

function salesForListingGrade(
  sales: MarketSale[],
  listing: MarketListing
): MarketSale[] {
  const key = listingGradeFilterKey(listing.grader, listing.grade);
  return sales.filter(
    (sale) => listingGradeFilterKey(sale.grader, sale.grade) === key
  );
}

function recentMedianPrice(sales: MarketSale[]): number | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const recent = sales.filter((sale) => sale.sale_date >= cutoffStr);
  const pool = recent.length > 0 ? recent : sales;
  if (pool.length === 0) return null;

  const prices = pool.map((sale) => sale.sale_price).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  if (prices.length % 2 === 0) {
    return Math.round(((prices[mid - 1] + prices[mid]) / 2) * 100) / 100;
  }
  return prices[mid];
}

function mockListingPrediction(
  listing: MarketListing,
  vsEstimatedPct: number | null,
  predictions?: MarketPredictionInsight
): ListingValuePrediction {
  if (predictions) {
    if (
      predictions.outlook === "bullish" &&
      vsEstimatedPct != null &&
      vsEstimatedPct <= 5
    ) {
      return "up";
    }
    if (
      predictions.outlook === "bearish" &&
      vsEstimatedPct != null &&
      vsEstimatedPct >= 10
    ) {
      return "down";
    }
    if (predictions.outlook === "neutral") {
      return "flat";
    }
  }

  const bucket = hashString(listing.id) % 5;
  if (bucket === 0 || bucket === 1) return "up";
  if (bucket === 2) return "down";
  return "flat";
}

export function isDoNotBuy(
  listing: MarketListing,
  estimatedValue: number | null,
  vsLastSalePct: number | null
): boolean {
  if (estimatedValue != null && estimatedValue > 0) {
    if (listing.price > estimatedValue * (1 + DO_NOT_BUY_TOLERANCE)) {
      return true;
    }
  }

  if (vsLastSalePct != null && vsLastSalePct >= 20) {
    return true;
  }

  return false;
}

export function analyzeListing(
  listing: MarketListing,
  sales: MarketSale[],
  predictions?: MarketPredictionInsight
): ListingAnalysis {
  const gradeSales = salesForListingGrade(sales, listing);
  const estimate = estimateMarketValue(gradeSales);
  const estimatedValue = estimate.value;

  const lastSale =
    gradeSales.length > 0
      ? [...gradeSales].sort((a, b) => b.sale_date.localeCompare(a.sale_date))[0]
      : null;
  const lastSalePrice = lastSale?.sale_price ?? null;
  const recentMedian = recentMedianPrice(gradeSales);

  const vsEstimatedPct = percentDiff(listing.price, estimatedValue);
  const vsLastSalePct = percentDiff(listing.price, lastSalePrice);
  const vsRecentMedianPct = percentDiff(listing.price, recentMedian);

  const recommended = isRecommendedBuy(listing, estimatedValue);
  const doNotBuy = isDoNotBuy(listing, estimatedValue, vsLastSalePct);

  let buySignal: ListingBuySignal = "neutral";
  if (recommended) buySignal = "recommended";
  else if (doNotBuy) buySignal = "do_not_buy";

  const prediction = mockListingPrediction(listing, vsEstimatedPct, predictions);

  return {
    buySignal,
    estimatedValue,
    lastSalePrice,
    vsEstimatedPct,
    vsLastSalePct,
    vsRecentMedianPct,
    prediction,
  };
}

export const LISTING_PREDICTION_LABELS: Record<ListingValuePrediction, string> = {
  up: "Increase",
  down: "Decrease",
  flat: "Stable",
};
