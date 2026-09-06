import {
  availableProvenance,
  unavailableProvenance,
} from "@/lib/card-investment/provenance/types";
import {
  confidenceFromScore,
  filterSalesByWindow,
  trimmedMedian,
  valuationConfidenceScore,
} from "@/lib/card-investment/types/math";
import type { ModelWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  CardInvestmentContext,
  CardMarketValuation,
  ValuationFactor,
} from "@/types/card-investment";
import { latestSaleAsOf } from "@/lib/card-investment/valuation/current-price";
import type { MarketSale } from "@/types/market-sales";

/** Comps used for FMV. The latest in-window print is current price, not a fair-value observation. */
export function compsForFairValue(sales: MarketSale[], asOf?: string): MarketSale[] {
  if (sales.length <= 1) return sales;
  const latest = asOf ? latestSaleAsOf(sales, asOf) : sales[0];
  if (!latest) return sales;
  return sales.filter((sale) => sale.id !== latest.id);
}

function windowMedian(
  sales: MarketSale[],
  days: number,
  asOf: string
): { value: number | null; outliersRejected: number; count: number } {
  const windowSales = filterSalesByWindow(sales, days, asOf);
  const prices = windowSales.map((sale) => sale.sale_price);
  const { value, outliersRejected } = trimmedMedian(prices);
  return { value, outliersRejected, count: windowSales.length };
}

function blendFairValue(
  medians: { d7: number | null; d30: number | null; d90: number | null },
  weights: ModelWeightProfile["valuation"]
): number | null {
  const entries: { value: number; weight: number }[] = [];

  if (medians.d7 != null) entries.push({ value: medians.d7, weight: weights.recency7d });
  if (medians.d30 != null) entries.push({ value: medians.d30, weight: weights.recency30d });
  if (medians.d90 != null) entries.push({ value: medians.d90, weight: weights.recency90d });

  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const blended =
    entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight;

  return Math.round(blended * 100) / 100;
}

export function computeCardValuation(
  context: CardInvestmentContext,
  weights: ModelWeightProfile
): CardMarketValuation {
  const { sales, asOf } = context;

  if (sales.length === 0) {
    return {
      fairValue: null,
      median7d: null,
      median30d: null,
      median90d: null,
      confidence: "none",
      confidenceScore: 0,
      compCount: 0,
      outliersRejected: 0,
      provenance: unavailableProvenance("market-sales", "No comparable sales"),
      factors: [],
    };
  }

  const comps = compsForFairValue(sales, asOf);
  const excludedCurrentPrint = comps.length !== sales.length;
  const factors: ValuationFactor[] = [];

  const w7 = windowMedian(comps, 7, asOf);
  const w30 = windowMedian(comps, 30, asOf);
  const w90 = windowMedian(comps, 90, asOf);
  let outliersRejected = w7.outliersRejected + w30.outliersRejected + w90.outliersRejected;

  let median7d = w7.value;
  const anchor = w30.value ?? w90.value;
  if (
    median7d != null &&
    anchor != null &&
    w7.count < 4 &&
    (median7d / anchor > 1.4 || median7d / anchor < 0.6)
  ) {
    median7d = null;
    outliersRejected += 1;
    factors.push({
      key: "thin_window_outlier",
      label: "Thin 7-day window ignored because it diverged from longer comps",
      impact: 1,
      direction: "neutral",
    });
  }

  const fairValue = blendFairValue(
    { d7: median7d, d30: w30.value, d90: w90.value },
    weights.valuation
  );

  const recentCount = filterSalesByWindow(comps, 30, asOf).length;
  const confidenceScore = valuationConfidenceScore(
    comps.length,
    recentCount,
    outliersRejected
  );

  if (excludedCurrentPrint) {
    factors.push({
      key: "current_print_excluded",
      label: "Latest print excluded from fair-value windows",
      impact: 1,
      direction: "neutral",
    });
  }
  if (median7d != null && w30.value != null && median7d !== w30.value) {
    const direction = median7d > w30.value ? "positive" : "negative";
    factors.push({
      key: "recent_momentum",
      label: "7-day median vs 30-day median",
      impact: Math.abs(((median7d - w30.value) / w30.value) * 100),
      direction,
    });
  }
  if (outliersRejected > 0) {
    factors.push({
      key: "outlier_rejection",
      label: `${outliersRejected} outlier sale(s) excluded`,
      impact: outliersRejected,
      direction: "neutral",
    });
  }

  return {
    fairValue,
    median7d,
    median30d: w30.value,
    median90d: w90.value,
    confidence: confidenceFromScore(confidenceScore, sales.length > 0),
    confidenceScore,
    compCount: sales.length,
    outliersRejected,
    provenance: availableProvenance("market-sales", asOf, `${sales.length} comps`),
    factors,
  };
}
