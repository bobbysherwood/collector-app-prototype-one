export const VALIDATION_AS_OF = "2026-08-15T12:00:00Z";

export const testConfig = {
  scoreTolerance: 2,
  rankingTolerance: 3,
  scoreRangeSlack: 5,
  confidenceThresholds: {
    high: 70,
    moderate: 50,
    low: 40,
  },
  recommendationThresholds: {
    strongBuy: 80,
    buy: 65,
    hold: 45,
    sell: 30,
  },
  returnThresholds: {
    buySuccessPct: 0,
    sellSuccessPct: 0,
  },
  expectedCorrelation: 0.15,
  expectedDirectionalAccuracy: 0.52,
  holdoutFraction: 0.2,
  datasets: {
    training: "training",
    validation: "validation",
    holdout: "holdout",
  } as const,
};

export type ValidationDatasetSplit = keyof typeof testConfig.datasets;
