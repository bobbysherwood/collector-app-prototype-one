import type { SportMarketIndexConfig } from "@/types/market-index";
import type { RawFeatureObservation } from "@/types/market-index";
import type { SportSeasonPhase } from "@/types/market-index";

export interface ProviderContext {
  sportId: string;
  config: SportMarketIndexConfig;
  asOf: Date;
  seasonPhase: SportSeasonPhase;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ProviderFetchResult {
  success: boolean;
  observations: RawFeatureObservation[];
  dataPointCount: number;
  error?: string;
  fetchedAt: string;
}

export interface IDataProvider {
  readonly slug: string;
  fetch(ctx: ProviderContext): Promise<ProviderFetchResult>;
  normalize(raw: unknown): RawFeatureObservation[];
  validate(raw: unknown): ValidationResult;
}

export function validProviderResult(
  partial: Omit<ProviderFetchResult, "fetchedAt"> & { fetchedAt?: string }
): ProviderFetchResult {
  return {
    fetchedAt: partial.fetchedAt ?? new Date().toISOString(),
    success: partial.success,
    observations: partial.observations,
    dataPointCount: partial.dataPointCount,
    error: partial.error,
  };
}

export function emptyValidation(): ValidationResult {
  return { valid: true, errors: [] };
}
