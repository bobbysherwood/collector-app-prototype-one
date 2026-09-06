import { testConfig } from "@/lib/model-validation/config";
import type { ValidationDatasetSplit } from "@/lib/model-validation/config";

/**
 * Conceptual dataset splits. Automated tests use synthetic fixtures only.
 * Holdout observations must not be used to tune weights or thresholds.
 */
export interface DatedObservation {
  asOf: string;
  split?: ValidationDatasetSplit;
}

export function assignDatasetSplit(
  asOf: string,
  orderedDates: string[]
): ValidationDatasetSplit {
  const unique = [...new Set(orderedDates)].sort();
  const index = unique.indexOf(asOf);
  if (index < 0) return "validation";

  const holdoutStart = Math.floor(unique.length * (1 - testConfig.holdoutFraction));
  const trainingEnd = Math.floor(unique.length * 0.6);

  if (index >= holdoutStart) return "holdout";
  if (index < trainingEnd) return "training";
  return "validation";
}

export function partitionBySplit<T extends DatedObservation>(
  rows: T[]
): Record<ValidationDatasetSplit, T[]> {
  const dates = rows.map((row) => row.asOf);
  const labeled = rows.map((row) => ({
    ...row,
    split: assignDatasetSplit(row.asOf, dates),
  }));

  return {
    training: labeled.filter((row) => row.split === "training"),
    validation: labeled.filter((row) => row.split === "validation"),
    holdout: labeled.filter((row) => row.split === "holdout"),
  };
}

export const DATASET_POLICY = {
  training: "Used only conceptually for model development. These tests do not tune weights.",
  validation: "Used for scenario/sensitivity checks and threshold inspection.",
  holdout: "Reserved for final backtest evaluation. Never used to adjust model parameters.",
} as const;
