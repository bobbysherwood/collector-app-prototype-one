import { assertNoLookAhead } from "@/lib/card-investment/backtesting/types";
import { buildCardInvestmentContextSync } from "@/lib/card-investment/build-card-context";
import { salesAvailableAsOf } from "@/lib/card-investment/valuation/current-price";
import { VALIDATION_AS_OF } from "@/lib/model-validation/config";
import { assignDatasetSplit } from "@/lib/model-validation/datasets";
import { makeAsset, makeDemand, makeQuality, makeSale } from "@/lib/model-validation/fixtures/builders";
import { markets } from "@/lib/model-validation/fixtures/markets";
import {
  summarizeBacktest,
  type BacktestObservation,
  type HistoricalCardSeries,
} from "@/lib/model-validation/engine/backtest";
import { computePlayerCardOpportunity } from "@/lib/player-card-opportunity/player-card-opportunity-model";
import { buildPlayerOpportunityContextSync } from "@/lib/player-opportunity/build-player-context";
import type { MarketSale } from "@/types/market-sales";

export interface ObservedSalesSeries {
  id: string;
  playerName: string;
  year: number;
  cardType: string;
  quality: number;
  demand: number;
  sales: MarketSale[];
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function priceOnOrBefore(sales: MarketSale[], date: string): number | null {
  const eligible = sales.filter((sale) => sale.sale_date <= date);
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => a.sale_date.localeCompare(b.sale_date)).at(-1)!.sale_price;
}

function forwardReturn(sales: MarketSale[], asOfDate: string, horizonDays: number): number | null {
  const start = priceOnOrBefore(sales, asOfDate);
  const future = priceOnOrBefore(sales, addDays(asOfDate, horizonDays));
  if (start == null || future == null || start === 0) return null;
  return (future - start) / start;
}

/** Replay an already-observed sale tape. Outcomes come only from later observed prints. */
export function runObservedSalesBacktest(
  seriesList: ObservedSalesSeries[]
): { observations: BacktestObservation[]; lookAheadViolations: number } {
  const observations: BacktestObservation[] = [];
  let lookAheadViolations = 0;

  for (const series of seriesList) {
    const dates = [...new Set(series.sales.map((sale) => sale.sale_date))].sort();
    const monthly = dates.filter((_, index) => index % 4 === 0);
    for (const asOfDate of monthly) {
      const asOf = `${asOfDate}T12:00:00Z`;
      if (asOf > VALIDATION_AS_OF) continue;

      const available = salesAvailableAsOf(series.sales, asOf);
      for (const sale of series.sales) {
        try {
          assertNoLookAhead(asOf, `${sale.sale_date}T12:00:00Z`);
        } catch {
          if (available.some((item) => item.id === sale.id)) lookAheadViolations += 1;
        }
      }

      const asset = makeAsset({
        id: series.id,
        player_name: series.playerName,
        year: series.year,
        card_type: series.cardType,
      });
      const playerContext = buildPlayerOpportunityContextSync(asset, {
        asOf,
        sportMarketOverride: markets.neutral,
        qualitySignals: makeQuality({
          careerStrength: series.quality,
          legacyStrength: series.quality - 4,
          culturalRelevance: series.quality - 2,
        }),
        demandSignals: makeDemand({
          attentionScore: series.demand,
          sentimentScore: series.demand,
          searchInterestScore: series.demand,
          discussionGrowthScore: series.demand - 6,
        }),
      });
      const cardContext = buildCardInvestmentContextSync(asset, available, {
        asOf,
        sportMarketOverride: markets.neutral,
      });
      const result = computePlayerCardOpportunity({ cardContext, playerContext });
      observations.push({
        assetId: series.id,
        asOf,
        split: "validation",
        opportunityScore: result.opportunityScore,
        predictedReturn90d: result.expectedReturn90d / 100,
        actualReturn30d: forwardReturn(series.sales, asOfDate, 30),
        actualReturn60d: forwardReturn(series.sales, asOfDate, 60),
        actualReturn90d: forwardReturn(series.sales, asOfDate, 90),
        recommendation: result.recommendation,
        lookAheadViolations: 0,
      });
    }
  }

  const dates = observations.map((row) => row.asOf);
  return {
    observations: observations.map((row) => ({
      ...row,
      split: assignDatasetSplit(row.asOf, dates),
    })),
    lookAheadViolations,
  };
}

export function historicalSeriesToObserved(series: HistoricalCardSeries): ObservedSalesSeries {
  return {
    id: series.id,
    playerName: series.playerName,
    year: series.year,
    cardType: series.cardType,
    quality: series.quality,
    demand: series.demand,
    sales: series.sales.map((sale, index) =>
      makeSale(sale.sale_price, 0, `${sale.sale_date}T12:00:00Z`, `-${series.id}-${index}`)
    ).map((sale, index) => ({
      ...sale,
      sale_date: series.sales[index].sale_date,
    })),
  };
}

export function summarizeObserved(observations: BacktestObservation[]) {
  return summarizeBacktest(observations);
}
