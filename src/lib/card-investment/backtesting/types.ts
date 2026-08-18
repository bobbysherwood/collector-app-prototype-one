import type { CardInvestmentProfile } from "@/types/card-investment";

/** Point-in-time inputs — must not include data after `asOf`. */
export interface BacktestInputSnapshot {
  assetId: string;
  asOf: string;
  horizonDays: number;
  inputs: Record<string, unknown>;
}

export interface BacktestPredictionRecord {
  assetId: string;
  asOf: string;
  horizonDays: number;
  predictedValue: number | null;
  actualValue: number | null;
  inputs: Record<string, unknown>;
  outputs: Partial<CardInvestmentProfile>;
}

export interface BacktestEvaluationResult {
  assetId: string;
  asOf: string;
  horizonDays: number;
  absoluteError: number | null;
  percentError: number | null;
  directionCorrect: boolean | null;
}

/** Validates that evaluation uses only information available at `asOf`. */
export function assertNoLookAhead(
  asOf: string,
  observedAt: string | null
): void {
  if (observedAt == null) return;
  const asOfMs = Date.parse(asOf);
  const observedMs = Date.parse(observedAt);
  if (Number.isNaN(asOfMs) || Number.isNaN(observedMs)) return;
  if (observedMs > asOfMs) {
    throw new Error(
      `Look-ahead violation: observation ${observedAt} is after asOf ${asOf}`
    );
  }
}

export interface BacktestEngine {
  runPrediction(snapshot: BacktestInputSnapshot): Promise<BacktestPredictionRecord>;
  evaluate(record: BacktestPredictionRecord): BacktestEvaluationResult;
}
