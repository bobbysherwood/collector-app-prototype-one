import { classifyCardArchetype } from "@/lib/card-investment/classification/card-archetype";
import { classifyCardEra } from "@/lib/card-investment/classification/card-era";
import { classifyPlayerLifecycle } from "@/lib/card-investment/classification/player-lifecycle";
import { fetchSportMarketSnapshot } from "@/lib/card-investment/market/sport-market-client";
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
}

function buildClassification(asset: Asset, asOf: string): CardClassification {
  const asOfYear = new Date(asOf).getFullYear();
  return {
    era: classifyCardEra(asset.year, asOfYear),
    archetype: classifyCardArchetype(asset),
    lifecycle: classifyPlayerLifecycle(asset),
    sportIndexId: resolveSportMarketIndexId(asset.sport),
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

  return {
    asset,
    asOf,
    sales,
    sportMarket,
    classification: buildClassification(asset, asOf),
  };
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
  return {
    asset,
    asOf,
    sales,
    sportMarket: options.sportMarketOverride ?? null,
    classification: buildClassification(asset, asOf),
  };
}
