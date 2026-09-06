import { assertNoLookAhead } from "@/lib/card-investment/backtesting/types";
import { buildCardInvestmentContextSync } from "@/lib/card-investment/build-card-context";
import { testConfig, VALIDATION_AS_OF } from "@/lib/model-validation/config";
import { assignDatasetSplit } from "@/lib/model-validation/datasets";
import { makeAsset, makeDemand, makeQuality, makeSale } from "@/lib/model-validation/fixtures/builders";
import { markets } from "@/lib/model-validation/fixtures/markets";
import { pearson } from "@/lib/model-validation/engine/ranking";
import type { BacktestSummary } from "@/lib/model-validation/types";
import { computePlayerCardOpportunity } from "@/lib/player-card-opportunity/player-card-opportunity-model";
import { buildPlayerOpportunityContextSync } from "@/lib/player-opportunity/build-player-context";
import type { PlayerCardRecommendation } from "@/types/player-opportunity";

export interface HistoricalFeature {
  key: string;
  value: unknown;
  availableAt: string;
}

export interface HistoricalSalePoint {
  sale_date: string;
  sale_price: number;
  availableAt: string;
}

export interface HistoricalCardSeries {
  id: string;
  playerName: string;
  year: number;
  cardType: string;
  insertParallel: string | null;
  quality: number;
  demand: number;
  fairValue: number;
  sales: HistoricalSalePoint[];
  features: HistoricalFeature[];
}

export interface BacktestObservation {
  assetId: string;
  asOf: string;
  split: "training" | "validation" | "holdout";
  opportunityScore: number;
  predictedReturn90d: number;
  actualReturn30d: number | null;
  actualReturn60d: number | null;
  actualReturn90d: number | null;
  recommendation: PlayerCardRecommendation;
  lookAheadViolations: number;
}

export const LOOKAHEAD_EXCEPTIONS = [
  "Synthetic fixtures do not include live API timestamps.",
];

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoAtNoon(date: string): string {
  return `${date}T12:00:00Z`;
}

/**
 * Deterministic synthetic price paths. After each as-of date, later prices
 * mean-revert toward fair value. That is a constructed market assumption used
 * to evaluate whether the model's valuation signal would have been useful —
 * not live collectibles data.
 */
export function buildSyntheticHistoricalUniverse(): HistoricalCardSeries[] {
  const start = "2025-09-01";
  const specs = [
    { id: "hist-star-cheap", playerName: "Jayson Tatum", year: 2017, quality: 88, demand: 72, fair: 1000, startPrice: 720 },
    { id: "hist-star-rich", playerName: "Jayson Tatum", year: 2017, quality: 88, demand: 72, fair: 1000, startPrice: 1450 },
    { id: "hist-good-fair", playerName: "Paolo Banchero", year: 2024, quality: 70, demand: 74, fair: 400, startPrice: 400 },
    { id: "hist-avg-cheap", playerName: "Role Player Smith", year: 2016, quality: 46, demand: 40, fair: 80, startPrice: 52 },
    { id: "hist-weak-rich", playerName: "Bench Guard Jones", year: 2015, quality: 34, demand: 28, fair: 40, startPrice: 70 },
    { id: "hist-star-base", playerName: "Anthony Edwards", year: 2024, quality: 82, demand: 80, fair: 250, startPrice: 190 },
    { id: "hist-vintage", playerName: "Michael Jordan", year: 1986, quality: 98, demand: 74, fair: 5000, startPrice: 4700 },
    { id: "hist-thin", playerName: "Luka Doncic", year: 2018, quality: 90, demand: 76, fair: 800, startPrice: 760 },
  ];

  return specs.map((spec) => {
    const sales: HistoricalSalePoint[] = [];
    let price = spec.startPrice;
    for (let week = 0; week < 48; week += 1) {
      const saleDate = addDays(start, week * 7);
      const revert = (spec.fair - price) * 0.12;
      const wobble = ((week % 5) - 2) * spec.fair * 0.008;
      price = Math.max(1, Math.round((price + revert + wobble) * 100) / 100);
      sales.push({
        sale_date: saleDate,
        sale_price: price,
        availableAt: isoAtNoon(saleDate),
      });
    }
    return {
      id: spec.id,
      playerName: spec.playerName,
      year: spec.year,
      cardType: spec.year < 1990 ? "Fleer Rookie" : "Panini Prizm Base",
      insertParallel: spec.id.includes("thin") ? null : spec.year < 1990 ? null : "Silver",
      quality: spec.quality,
      demand: spec.demand,
      fairValue: spec.fair,
      sales,
      features: sales.map((sale) => ({
        key: `sale:${sale.sale_date}`,
        value: sale.sale_price,
        availableAt: sale.availableAt,
      })),
    };
  });
}

export function filterAvailableFeatures(
  features: HistoricalFeature[],
  asOf: string
): { available: HistoricalFeature[]; violations: HistoricalFeature[] } {
  const available: HistoricalFeature[] = [];
  const violations: HistoricalFeature[] = [];
  for (const feature of features) {
    if (Date.parse(feature.availableAt) <= Date.parse(asOf)) {
      available.push(feature);
    } else {
      violations.push(feature);
    }
  }
  return { available, violations };
}

export function enforceLookAhead(asOf: string, features: HistoricalFeature[]): number {
  let violations = 0;
  for (const feature of features) {
    try {
      assertNoLookAhead(asOf, feature.availableAt);
    } catch {
      violations += 1;
    }
  }
  return violations;
}

function priceOnOrBefore(sales: HistoricalSalePoint[], date: string): number | null {
  const eligible = sales.filter((sale) => sale.sale_date <= date);
  return eligible.length ? eligible[eligible.length - 1].sale_price : null;
}

function forwardReturn(
  sales: HistoricalSalePoint[],
  asOfDate: string,
  horizonDays: number
): number | null {
  const start = priceOnOrBefore(sales, asOfDate);
  const future = priceOnOrBefore(sales, addDays(asOfDate, horizonDays));
  if (start == null || future == null || start === 0) return null;
  return (future - start) / start;
}

export function runPointInTimeBacktest(
  universe = buildSyntheticHistoricalUniverse(),
  options: { includeHoldout?: boolean } = {}
): { observations: BacktestObservation[]; summary: BacktestSummary } {
  const includeHoldout = options.includeHoldout ?? true;
  const observations: BacktestObservation[] = [];

  for (const series of universe) {
    const monthly = series.sales.filter((_, index) => index % 4 === 0);
    for (const point of monthly) {
      const asOf = isoAtNoon(point.sale_date);
      if (asOf > VALIDATION_AS_OF) continue;

      const { available } = filterAvailableFeatures(series.features, asOf);
      const availableSales = series.sales.filter((sale) => sale.availableAt <= asOf);
      const usedFutureFeatures = series.features.filter((feature) =>
        available.some((item) => item.key === feature.key && feature.availableAt > asOf)
      );
      const violations = enforceLookAhead(asOf, usedFutureFeatures);

      const asset = makeAsset({
        id: series.id,
        player_name: series.playerName,
        year: series.year,
        card_type: series.cardType,
        insert_parallel: series.insertParallel,
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
      const cardContext = buildCardInvestmentContextSync(
        asset,
        availableSales.map((sale, index) =>
          makeSale(sale.sale_price, 0, isoAtNoon(sale.sale_date), `-${series.id}-${index}`)
        ),
        { asOf, sportMarketOverride: markets.neutral }
      );
      cardContext.sales = availableSales.map((sale, index) => ({
        ...makeSale(sale.sale_price, 0, isoAtNoon(sale.sale_date), `-${series.id}-${index}`),
        sale_date: sale.sale_date,
      }));

      const result = computePlayerCardOpportunity({ cardContext, playerContext });
      observations.push({
        assetId: series.id,
        asOf,
        split: "validation",
        opportunityScore: result.opportunityScore,
        predictedReturn90d: result.expectedReturn90d / 100,
        actualReturn30d: forwardReturn(series.sales, point.sale_date, 30),
        actualReturn60d: forwardReturn(series.sales, point.sale_date, 60),
        actualReturn90d: forwardReturn(series.sales, point.sale_date, 90),
        recommendation: result.recommendation,
        lookAheadViolations: violations,
      });
    }
  }

  const dates = observations.map((row) => row.asOf);
  const labeled = observations.map((row) => ({
    ...row,
    split: assignDatasetSplit(row.asOf, dates),
  }));

  const evalSet = includeHoldout
    ? labeled.filter((row) => row.split === "holdout" || row.split === "validation")
    : labeled.filter((row) => row.split === "validation");

  return {
    observations: labeled,
    summary: summarizeBacktest(evalSet),
  };
}

export function summarizeBacktest(rows: BacktestObservation[]): BacktestSummary {
  const usable = rows.filter((row) => row.actualReturn90d != null);
  const scores = usable.map((row) => row.opportunityScore);
  const actuals = usable.map((row) => row.actualReturn90d as number);
  const predicted = usable.map((row) => row.predictedReturn90d);
  const directional =
    usable.length === 0
      ? null
      : usable.filter((row) => Math.sign(row.predictedReturn90d) === Math.sign(row.actualReturn90d ?? 0)).length /
        usable.length;

  const sorted = [...usable].sort((a, b) => a.opportunityScore - b.opportunityScore);
  const decile = Math.max(1, Math.floor(sorted.length / 10));
  const bottom = sorted.slice(0, decile);
  const top = sorted.slice(-decile);

  void predicted;

  return {
    observations: usable.length,
    correlation90d: pearson(scores, actuals),
    directionalAccuracy: directional,
    topDecileReturn: average(top.map((row) => row.actualReturn90d as number)),
    bottomDecileReturn: average(bottom.map((row) => row.actualReturn90d as number)),
    lookAheadViolations: rows.reduce((sum, row) => sum + row.lookAheadViolations, 0),
  };
}

export function bucketReturns(rows: BacktestObservation[]): Array<{
  bucket: string;
  average: number | null;
  median: number | null;
  count: number;
}> {
  const edges = [100, 90, 80, 70, 60, 50, 0];
  const buckets: Array<{ bucket: string; values: number[] }> = [
    { bucket: "90–100", values: [] },
    { bucket: "80–89", values: [] },
    { bucket: "70–79", values: [] },
    { bucket: "60–69", values: [] },
    { bucket: "50–59", values: [] },
    { bucket: "0–49", values: [] },
  ];

  for (const row of rows) {
    if (row.actualReturn90d == null) continue;
    const score = row.opportunityScore;
    if (score >= 90) buckets[0].values.push(row.actualReturn90d);
    else if (score >= 80) buckets[1].values.push(row.actualReturn90d);
    else if (score >= 70) buckets[2].values.push(row.actualReturn90d);
    else if (score >= 60) buckets[3].values.push(row.actualReturn90d);
    else if (score >= 50) buckets[4].values.push(row.actualReturn90d);
    else buckets[5].values.push(row.actualReturn90d);
  }

  void edges;
  return buckets.map((bucket) => ({
    bucket: bucket.bucket,
    average: average(bucket.values),
    median: median(bucket.values),
    count: bucket.values.length,
  }));
}

export function recommendationConfusion(
  rows: BacktestObservation[],
  buySuccessPct = testConfig.returnThresholds.buySuccessPct,
  sellSuccessPct = testConfig.returnThresholds.sellSuccessPct
) {
  const buyLike: PlayerCardRecommendation[] = ["buy", "strong_buy"];
  const sellLike: PlayerCardRecommendation[] = ["sell", "strong_sell"];
  let buyTp = 0;
  let buyFp = 0;
  let buyFn = 0;
  let sellTp = 0;
  let sellFp = 0;
  let sellFn = 0;
  let directionalHits = 0;
  let directionalTotal = 0;

  for (const row of rows) {
    if (row.actualReturn90d == null) continue;
    const actual = row.actualReturn90d;
    const predictedBuy = buyLike.includes(row.recommendation);
    const predictedSell = sellLike.includes(row.recommendation);
    const actualUp = actual > buySuccessPct;
    const actualDown = actual < sellSuccessPct;

    if (predictedBuy && actualUp) buyTp += 1;
    if (predictedBuy && !actualUp) buyFp += 1;
    if (!predictedBuy && actualUp) buyFn += 1;
    if (predictedSell && actualDown) sellTp += 1;
    if (predictedSell && !actualDown) sellFp += 1;
    if (!predictedSell && actualDown) sellFn += 1;

    if (predictedBuy || predictedSell) {
      directionalTotal += 1;
      if ((predictedBuy && actual > 0) || (predictedSell && actual < 0)) directionalHits += 1;
    }
  }

  const precision = (tp: number, fp: number) => (tp + fp === 0 ? null : tp / (tp + fp));
  const recall = (tp: number, fn: number) => (tp + fn === 0 ? null : tp / (tp + fn));

  return {
    buyPrecision: precision(buyTp, buyFp),
    buyRecall: recall(buyTp, buyFn),
    sellPrecision: precision(sellTp, sellFp),
    sellRecall: recall(sellTp, sellFn),
    directionalAccuracy: directionalTotal === 0 ? null : directionalHits / directionalTotal,
    falsePositiveRate: buyTp + buyFp === 0 ? null : buyFp / (buyTp + buyFp),
    falseNegativeRate: buyTp + buyFn === 0 ? null : buyFn / (buyTp + buyFn),
  };
}

export function riskAdjustedMetrics(returns: number[]) {
  if (returns.length === 0) {
    return { average: null, median: null, hitRate: null, maxDrawdown: null, downsideDeviation: null, sharpe: null, sortino: null };
  }
  const avg = average(returns) ?? 0;
  const downside = returns.filter((value) => value < 0);
  const variance = returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / returns.length;
  const stdev = Math.sqrt(variance);
  const downVar = downside.length
    ? downside.reduce((sum, value) => sum + value ** 2, 0) / downside.length
    : 0;
  const downDev = Math.sqrt(downVar);
  return {
    average: avg,
    median: median(returns),
    hitRate: returns.filter((value) => value > 0).length / returns.length,
    maxDrawdown: maxDrawdown(returns),
    downsideDeviation: downDev,
    sharpe: stdev === 0 ? null : avg / stdev,
    sortino: downDev === 0 ? null : avg / downDev,
  };
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function maxDrawdown(returns: number[]): number {
  let peak = 1;
  let nav = 1;
  let drawdown = 0;
  for (const value of returns) {
    nav *= 1 + value;
    peak = Math.max(peak, nav);
    drawdown = Math.min(drawdown, nav / peak - 1);
  }
  return drawdown;
}
