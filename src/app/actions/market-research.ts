"use server";

import { dm2CardToSyntheticAsset } from "@/lib/dm2-card-to-asset";
import { getEbayListingsForAsset } from "@/lib/market-sales/ebay-listings-provider";
import { getMockMarketPredictions } from "@/lib/market-sales/mock-predictions-provider";
import { getMockMarketSales } from "@/lib/market-sales/mock-provider";
import type { Asset } from "@/types/asset";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";
import type { MarketPredictionInsight } from "@/types/market-predictions";
import type { MarketListing, MarketSalesResult } from "@/types/market-sales";

export interface MarketResearchCardMarketData {
  asset: Asset;
  marketSales: MarketSalesResult;
  predictions: MarketPredictionInsight;
  ebayListings: MarketListing[];
  listingsAsOf: string | null;
  listingsError?: string;
  ebaySandboxMode: boolean;
}

export async function getMarketResearchCardMarketData(
  card: Dm2CardSearchResult
): Promise<MarketResearchCardMarketData> {
  const asset = dm2CardToSyntheticAsset(card);
  const marketSales = getMockMarketSales(asset);
  const ebayListings = await getEbayListingsForAsset(asset);

  return {
    asset,
    marketSales,
    predictions: getMockMarketPredictions(card, marketSales.sales),
    ebayListings: ebayListings.listings,
    listingsAsOf: ebayListings.as_of,
    listingsError: ebayListings.error,
    ebaySandboxMode: ebayListings.sandbox_mode,
  };
}
