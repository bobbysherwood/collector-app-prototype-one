import type { Grader } from "@/types/asset";

export type MarketSaleSource = "ebay" | "fanatics_collect";

export type MarketSaleType = "auction" | "buy_it_now" | "best_offer";

export type MarketSaleMatchConfidence = "high" | "medium" | "low";

/** A completed sale on an external marketplace (not the user's own sale). */
export interface MarketSale {
  id: string;
  source: MarketSaleSource;
  title: string;
  grader: Grader | null;
  grade: string | null;
  sale_price: number;
  /** Hammer before buyer's premium (Fanatics auctions). */
  hammer_price: number | null;
  buyers_premium_pct: number | null;
  currency: "USD";
  sale_date: string;
  sale_type: MarketSaleType;
  listing_url: string;
  match_confidence: MarketSaleMatchConfidence;
}

export interface MarketSalesSummary {
  sale_count: number;
  median_price: number | null;
  average_price: number | null;
  low_price: number | null;
  high_price: number | null;
  last_sale_date: string | null;
}

export interface MarketSalesResult {
  sales: MarketSale[];
  listings: MarketListing[];
  summary: MarketSalesSummary;
  /** ISO timestamp — populated when data is fetched from a provider. */
  as_of: string | null;
}

export type MarketListingType = "auction" | "buy_it_now";

/** An active marketplace listing (auction or buy-it-now). */
export interface MarketListing {
  id: string;
  source: MarketSaleSource;
  title: string;
  grader: Grader | null;
  grade: string | null;
  listing_type: MarketListingType;
  /** Current bid for auctions, or buy-now price for fixed listings. */
  price: number;
  bid_count: number | null;
  ends_at: string;
  listing_url: string;
  match_confidence: MarketSaleMatchConfidence;
  currency: "USD";
}

export const MARKET_SALE_SOURCE_LABELS: Record<MarketSaleSource, string> = {
  ebay: "eBay",
  fanatics_collect: "Fanatics Collect",
};

export const MARKET_SALE_TYPE_LABELS: Record<MarketSaleType, string> = {
  auction: "Auction",
  buy_it_now: "Buy It Now",
  best_offer: "Best Offer",
};

export const MARKET_LISTING_TYPE_LABELS: Record<MarketListingType, string> = {
  auction: "Auction",
  buy_it_now: "Buy It Now",
};
