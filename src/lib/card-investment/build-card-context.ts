import { classifyCardArchetype } from "@/lib/card-investment/classification/card-archetype";
import { classifyCardEra } from "@/lib/card-investment/classification/card-era";
import { classifyPlayerLifecycle } from "@/lib/card-investment/classification/player-lifecycle";
import { fetchSportMarketSnapshot } from "@/lib/card-investment/market/sport-market-client";
import { inferManufacturer, inferSupplyFromMetadata } from "@/lib/card-investment/scarcity/infer-supply";
import { latestSaleAsOf } from "@/lib/card-investment/valuation/current-price";
import { getAsset, getLotsForAsset } from "@/lib/data";
import { getMockMarketSales } from "@/lib/market-sales/mock-provider";
import { resolveSportMarketIndexId } from "@/lib/market-index/resolve-sport-index-id";
import type {
  CardClassification,
  CardInvestmentContext,
} from "@/types/card-investment";
import type { Asset } from "@/types/asset";
import type { MarketSale } from "@/types/market-sales";

export interface BuildCardContextOptions {
  asOf?: string;
  sales?: MarketSale[];
  sportMarketOverride?: CardInvestmentContext["sportMarket"];
  supply?: CardInvestmentContext["supply"];
}

function buildClassification(asset: Asset, asOf: string): CardClassification {
  const asOfYear = new Date(asOf).getFullYear();
  return {
    era: classifyCardEra(asset.year, asOfYear),
    archetype: classifyCardArchetype(asset, asOfYear),
    lifecycle: classifyPlayerLifecycle(asset, asOfYear),
    sportIndexId: resolveSportMarketIndexId(asset.sport),
  };
}

function withInferredFields(
  asset: Asset,
  sales: MarketSale[],
  asOf: string,
  options: BuildCardContextOptions,
  sportMarket: CardInvestmentContext["sportMarket"]
): CardInvestmentContext {
  const classification = buildClassification(asset, asOf);
  return {
    asset,
    asOf,
    sales,
    sportMarket,
    classification,
    supply: options.supply ?? inferSupplyFromMetadata(asset, classification.era),
    manufacturer: inferManufacturer(asset),
    grader: latestSaleAsOf(sales, asOf)?.grader ?? null,
  };
}

export async function buildCardInvestmentContext(
  asset: Asset,
  options: BuildCardContextOptions = {}
): Promise<CardInvestmentContext> {
  const asOf = options.asOf ?? new Date().toISOString();

  let sales = options.sales;
  if (!sales) {
    const lots = await getLotsForAsset(asset.id);
    sales = getMockMarketSales(asset, lots).sales;
  }

  const sportMarket =
    options.sportMarketOverride !== undefined
      ? options.sportMarketOverride
      : await fetchSportMarketSnapshot(asset.sport);

  return withInferredFields(asset, sales, asOf, options, sportMarket);
}

export async function buildCardInvestmentContextById(
  assetId: string,
  options: BuildCardContextOptions = {}
): Promise<CardInvestmentContext | null> {
  const asset = await getAsset(assetId);
  if (!asset) return null;
  return buildCardInvestmentContext(asset, options);
}

export function buildCardInvestmentContextSync(
  asset: Asset,
  sales: MarketSale[],
  options: Omit<BuildCardContextOptions, "sales"> = {}
): CardInvestmentContext {
  const asOf = options.asOf ?? new Date().toISOString();
  return withInferredFields(asset, sales, asOf, options, options.sportMarketOverride ?? null);
}
