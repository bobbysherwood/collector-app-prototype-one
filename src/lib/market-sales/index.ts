import type { Asset, Lot } from "@/types/asset";
import type { MarketSalesResult } from "@/types/market-sales";
import { getMockMarketSales } from "@/lib/market-sales/mock-provider";

export { buildMarketSalesSummary } from "@/lib/market-sales/summary";
export { getMockMarketSales } from "@/lib/market-sales/mock-provider";
export {
  estimateMarketValue,
  MARKET_ESTIMATE_CONFIDENCE_LABELS,
} from "@/lib/market-sales/estimate";
export type {
  MarketEstimatedValue,
  MarketEstimateConfidence,
} from "@/lib/market-sales/estimate";

export type MarketSalesProvider = (
  asset: Asset,
  lots: Lot[]
) => MarketSalesResult | Promise<MarketSalesResult>;

/** Default provider until eBay / Fanatics integrations are wired up. */
export const marketSalesProvider: MarketSalesProvider = getMockMarketSales;

export async function getMarketSalesForAsset(
  asset: Asset,
  lots: Lot[]
): Promise<MarketSalesResult> {
  return await marketSalesProvider(asset, lots);
}
