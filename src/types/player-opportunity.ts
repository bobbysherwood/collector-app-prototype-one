import type { Catalyst, SportMarketSnapshot } from "@/types/card-investment";

export const PLAYER_OPPORTUNITY_MODEL_VERSION = "player-opportunity-v1.0.0";
export const PLAYER_CARD_OPPORTUNITY_MODEL_VERSION = "player-card-opportunity-v1.0.0";

export type PlayerOpportunityLifecycle =
  | "prospect"
  | "active"
  | "retired"
  | "deceased";

export type PlayerOpportunityTrend =
  | "strongly_increasing"
  | "increasing"
  | "neutral"
  | "declining"
  | "strongly_declining";

export type PlayerCardRecommendation =
  | "strong_buy"
  | "buy"
  | "hold"
  | "sell"
  | "strong_sell";

export interface OpportunityCatalyst extends Catalyst {
  type: string;
  direction: "positive" | "negative" | "neutral";
  expectedMagnitude: number;
  expectedDurationDays: number;
}

export interface PlayerQualitySignals {
  careerStrength?: number | null;
  legacyStrength?: number | null;
  culturalRelevance?: number | null;
  injuryRisk?: number | null;
  availableFieldCount: number;
  provenanceNotes?: string[];
}

export interface PlayerDemandSignals {
  attentionScore?: number | null;
  sentimentScore?: number | null;
  searchInterestScore?: number | null;
  discussionGrowthScore?: number | null;
  sourceCount: number;
  provenanceNotes?: string[];
}

export interface PlayerOpportunityContext {
  playerId: string;
  playerName: string;
  sport: string;
  lifecycle: PlayerOpportunityLifecycle;
  asOf: string;
  sportMarket: SportMarketSnapshot | null;
  qualitySignals?: PlayerQualitySignals;
  demandSignals?: PlayerDemandSignals;
  catalysts?: OpportunityCatalyst[];
}

export interface PlayerOpportunityWeightProfile {
  id: string;
  label: string;
  playerQuality: number;
  futureOutlook: number;
  demand: number;
  sportMarket: number;
  momentum: number;
  catalysts: number;
}

export interface PlayerCardOpportunityWeightProfile {
  id: string;
  label: string;
  playerOpportunity: number;
  valuation: number;
  scarcity: number;
  demand: number;
  expectedReturn: number;
  riskAdjustedReturn: number;
  liquidity: number;
}

export interface OpportunityThresholds {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
}

export interface PlayerOpportunity {
  playerId: string;
  playerName: string;
  sport: string;
  lifecycle: PlayerOpportunityLifecycle;
  modelVersion: string;
  computedAt: string;

  opportunityScore: number;
  qualityScore: number;
  futureOutlookScore: number;
  demandScore: number;
  sportMarketScore: number;
  momentumScore: number;

  expectedDemandChange90d: number;
  riskScore: number;
  confidenceScore: number;

  trend: PlayerOpportunityTrend;

  positiveDrivers: string[];
  negativeDrivers: string[];
  catalysts: OpportunityCatalyst[];

  summary: string;
  weightProfileId: string;
  /** Baseline FMV from player evaluation context (when card context was provided). */
  referenceFairValue?: number | null;
  inputs: Record<string, unknown>;
}

export interface PlayerCardOpportunity {
  cardId: string;
  playerId: string;
  modelVersion: string;
  computedAt: string;

  opportunityScore: number;
  playerOpportunityScore: number;

  valuationScore: number;
  scarcityScore: number;
  demandScore: number;
  returnScore: number;
  riskAdjustedReturnScore: number;
  liquidityScore: number;

  currentMarketValue: number;
  fairMarketValue: number;

  expectedValue90d: number;
  expectedReturn90d: number;

  upsideScenario: number;
  baseScenario: number;
  downsideScenario: number;

  marginOfSafety: number;
  priceToFairValueRatio: number;

  riskScore: number;
  volatilityScore: number;
  confidenceScore: number;

  recommendation: PlayerCardRecommendation;

  positiveDrivers: string[];
  negativeDrivers: string[];
  catalysts: OpportunityCatalyst[];

  summary: string;
  weightProfileId: string;
  inputs: Record<string, unknown>;
}

export interface PlayerOpportunitySnapshotRow {
  id: string;
  playerId: string;
  opportunity: PlayerOpportunity;
  modelVersion: string;
  computedAt: string;
}

export interface PlayerCardOpportunitySnapshotRow {
  id: string;
  assetId: string;
  opportunity: PlayerCardOpportunity;
  modelVersion: string;
  computedAt: string;
}
