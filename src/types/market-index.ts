export type SportMarketIndexRiskRating = "low" | "medium" | "high";

export type SportMarketFeatureCategory =
  | "market"
  | "demand"
  | "supply"
  | "sentiment";

export type SportSeasonPhase =
  | "regular"
  | "playoffs"
  | "draft"
  | "offseason";

export interface SportSeasonConfig {
  seasonStart?: string;
  seasonEnd?: string;
  draftDate?: string;
  playoffsStart?: string;
  finalsEnd?: string;
}

export interface SportSearchTerms {
  default?: string[];
  sentiment?: string[];
  reddit?: string[];
  trends?: string[];
  ebay?: string[];
}

export interface SportProviderConfig {
  enabledProviders: string[];
}

export interface SportIndexWeightMap {
  [featureKey: string]: number;
}

export interface SportOutlookBlendWeights {
  health: number;
  momentum: number;
  leading_bundle: number;
}

export interface SportIndexWeights {
  health: SportIndexWeightMap;
  momentum: SportIndexWeightMap;
  outlook_blend: SportOutlookBlendWeights;
}

export interface SportForecastConfig {
  leadingIndicatorFeatures?: string[];
  ensembleWeights?: {
    rules?: number;
    ridge?: number;
    gbm?: number;
  };
  rulesCoefficients?: {
    outlook_to_3m?: number;
    momentum_adj?: number;
    horizon_6m_multiplier?: number;
    horizon_12m_multiplier?: number;
    decay_pull_strength?: number;
  };
  ridgeCoefficients?: Record<string, number>;
}

export interface SportRiskThresholds {
  lowConfidenceMin?: number;
  mediumConfidenceMin?: number;
  highSupplyHeadwindCount?: number;
}

export interface SportMarketIndexConfig {
  id: string;
  name: string;
  active: boolean;
  pickListSportId?: string | null;
  seasonConfig: SportSeasonConfig;
  searchTerms: SportSearchTerms;
  providerConfig: SportProviderConfig;
  indexWeights: SportIndexWeights;
  forecastConfig: SportForecastConfig;
  seasonModifiers: Record<string, Record<string, number>>;
  riskThresholds: SportRiskThresholds;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RawFeatureObservation {
  featureKey: string;
  featureCategory: SportMarketFeatureCategory;
  value: number;
  delta30dPct?: number | null;
  providerSlug: string;
  metadata?: Record<string, unknown>;
}

export interface SportMarketFeatureRecord extends RawFeatureObservation {
  sportId: string;
  observedAt: string;
  zScore?: number | null;
}

export interface SportFeatureVector {
  values: Record<string, number>;
  deltas30dPct: Record<string, number>;
  observedAt: string;
  providerCoverage: number;
  dataPointCount: number;
}

export interface IndexDriver {
  featureKey: string;
  label: string;
  deltaPct: number | null;
  impactPoints: number;
  direction: "positive" | "negative" | "neutral";
}

export interface SportMarketIndexResult {
  sportId: string;
  sportName: string;
  healthScore: number;
  momentumScore: number;
  outlookScore: number;
  forecast3mPct: number;
  forecast6mPct: number;
  forecast12mPct: number;
  confidenceScore: number;
  riskRating: SportMarketIndexRiskRating;
  positiveDrivers: IndexDriver[];
  negativeDrivers: IndexDriver[];
  explanation: string;
  modelVersion: string;
  seasonPhase: SportSeasonPhase;
  asOf: string;
  featureSnapshot?: SportFeatureVector;
}

export interface SportMarketIndexSnapshotRow {
  id: string;
  sportId: string;
  result: SportMarketIndexResult;
  computedAt: string;
}

export const SPORT_MARKET_INDEX_MODEL_VERSION = "sport-index-v1.0.0";

export const SPORT_MARKET_INDEX_PROVIDER_SLUGS = [
  "market-sentiment-composite",
  "ebay-market",
  "product-calendar",
] as const;

export type SportMarketIndexProviderSlug =
  (typeof SPORT_MARKET_INDEX_PROVIDER_SLUGS)[number];

export function humanizeFeatureKey(featureKey: string): string {
  const parts = featureKey.split(".");
  const tail = parts[parts.length - 1] ?? featureKey;
  return tail
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
