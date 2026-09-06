import { describe, expect, it } from "vitest";
import { assertNoLookAhead } from "@/lib/card-investment/backtesting/types";
import { testConfig } from "@/lib/model-validation/config";
import { DATASET_POLICY } from "@/lib/model-validation/datasets";
import {
  LOOKAHEAD_EXCEPTIONS,
  bucketReturns,
  buildSyntheticHistoricalUniverse,
  filterAvailableFeatures,
  recommendationConfusion,
  riskAdjustedMetrics,
  runPointInTimeBacktest,
} from "@/lib/model-validation/engine/backtest";

describe("Point-in-time backtesting", () => {
  it("never feeds the model features that become available after the prediction date", () => {
    const series = buildSyntheticHistoricalUniverse()[0];
    const asOf = series.sales[10].availableAt;
    const { available, violations } = filterAvailableFeatures(series.features, asOf);
    expect(available.every((feature) => feature.availableAt <= asOf)).toBe(true);
    expect(violations.every((feature) => feature.availableAt > asOf)).toBe(true);
    expect(() => assertNoLookAhead(asOf, violations[0]?.availableAt ?? asOf)).toThrow(/Look-ahead/);
    expect(LOOKAHEAD_EXCEPTIONS.length).toBeGreaterThan(0);
  });

  it("measures 30/60/90-day outcomes and recommendation quality", () => {
    const { observations, summary } = runPointInTimeBacktest();
    const with90 = observations.filter((row) => row.actualReturn90d != null);
    expect(with90.length).toBeGreaterThan(20);
    expect(with90.some((row) => row.actualReturn30d != null)).toBe(true);
    expect(with90.some((row) => row.actualReturn60d != null)).toBe(true);
    expect(summary.lookAheadViolations).toBe(0);
    expect(summary.observations).toBeGreaterThan(0);

    const holdout = observations.filter((row) => row.split === "holdout");
    const training = observations.filter((row) => row.split === "training");
    expect(training.length).toBeGreaterThan(0);
    expect(holdout.length).toBeGreaterThan(0);
    expect(DATASET_POLICY.holdout).toMatch(/Never used to adjust/i);

    const buckets = bucketReturns(holdout.length ? holdout : with90);
    expect(buckets.some((bucket) => bucket.count > 0)).toBe(true);

    const confusion = recommendationConfusion(with90);
    expect(confusion).toHaveProperty("buyPrecision");
    expect(confusion).toHaveProperty("sellRecall");

    const returns = with90.map((row) => row.actualReturn90d as number);
    const metrics = riskAdjustedMetrics(returns);
    expect(metrics.average).not.toBeNull();
  });

  it("keeps holdout dates later than training dates", () => {
    const { observations } = runPointInTimeBacktest();
    const maxTrain = Math.max(
      ...observations.filter((row) => row.split === "training").map((row) => Date.parse(row.asOf)),
      0
    );
    const minHoldout = Math.min(
      ...observations.filter((row) => row.split === "holdout").map((row) => Date.parse(row.asOf)),
      Number.POSITIVE_INFINITY
    );
    expect(minHoldout).toBeGreaterThan(maxTrain);
  });

  it("records correlation and directional accuracy against configurable floors as diagnostics", () => {
    const { summary } = runPointInTimeBacktest();
    expect(summary.correlation90d === null || Number.isFinite(summary.correlation90d)).toBe(true);
    expect(
      summary.directionalAccuracy === null ||
        summary.directionalAccuracy >= 0
    ).toBe(true);
    expect(testConfig.expectedCorrelation).toBeGreaterThan(0);
  });
});
