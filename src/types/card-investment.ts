import type { Asset } from "@/types/asset";
import type { MarketSale } from "@/types/market-sales";

export const CARD_INVESTMENT_MODEL_VERSION = "card-investment-v1.0.0";

export type InvestmentConfidence = "high" | "medium" | "low" | "none";

export type InvestmentRating =
  | "strong_buy"
  | "buy"
  | "hold"
  | "avoid"
  | "insufficient_data";

export type CardRiskLevel = "low" | "medium" | "high";

export type PlayerLifecycleStage =
  | "rising"
  | "peak"
  | "declining"
  | "legacy"
  | "unknown";

export type CardEra =
  | "pre_war"
  | "vintage"
  | "junk_wax"
  | "early_modern"
  | "modern"
  | "ultra_modern"
  | "unknown";

export type CardArchetype =
  | "rookie"
  | "base"
  | "parallel"
  | "auto"
  | "memorabilia"
  | "hof_legacy"
  | "unknown";

export interface DataProvenance {
  source: string;
  observedAt: string | null;
  available: boolean;
  notes?: string;
}

export interface SportMarketSnapshot {
  sportId: string;
  healthScore: number;
  momentumScore: number;
  outlookScore: number;
  forecast3mPct: number;
  confidenceScore: number;
  riskRating: CardRiskLevel;
  seasonPhase: string;
  asOf: string;
  provenance: DataProvenance;
}

export interface ValuationFactor {
  key: string;
  label: string;
  impact: number;
  direction: "positive" | "negative" | "neutral";
}

/** Fair-market valuation output (distinct from lot CardValuation records). */
export interface CardMarketValuation {
  fairValue: number | null;
  median7d: number | null;
  median30d: number | null;
  median90d: number | null;
  confidence: InvestmentConfidence;
  confidenceScore: number;
  compCount: number;
  outliersRejected: number;
  provenance: DataProvenance;
  factors: ValuationFactor[];
}

export interface PlayerLegacyScore {
  score: number;
  lifecycle: PlayerLifecycleStage;
  confidence: InvestmentConfidence;
  factors: ValuationFactor[];
  provenance: DataProvenance;
}

export interface ScarcityScore {
  score: number;
  tier: "common" | "scarce" | "rare" | "ultra_rare" | "unknown";
  confidence: InvestmentConfidence;
  factors: ValuationFactor[];
  provenance: DataProvenance;
}

export interface CardDemandScore {
  score: number;
  sentiment: "bullish" | "neutral" | "bearish";
  confidence: InvestmentConfidence;
  factors: ValuationFactor[];
  provenance: DataProvenance;
}

export interface CardRisk {
  overallRisk: CardRiskLevel;
  volatilityScore: number;
  liquidityScore: number;
  confidence: InvestmentConfidence;
  factors: ValuationFactor[];
  provenance: DataProvenance;
}

export interface Catalyst {
  id: string;
  label: string;
  expectedImpact: "positive" | "negative" | "neutral";
  windowDays: number;
  confidence: InvestmentConfidence;
}

export interface SeasonalityForecast {
  seasonalityScore: number;
  phase: string;
  catalysts: Catalyst[];
  confidence: InvestmentConfidence;
  factors: ValuationFactor[];
  provenance: DataProvenance;
}

export interface CardForecast {
  horizonDays: 90;
  predictedValue: number | null;
  predictedChangePct: number | null;
  direction: "up" | "down" | "flat" | "unknown";
  confidence: InvestmentConfidence;
  factors: ValuationFactor[];
  provenance: DataProvenance;
}

export interface InvestmentRecommendation {
  rating: InvestmentRating;
  score: number;
  confidence: InvestmentConfidence;
  horizonDays: number;
  summary: string;
  factors: ValuationFactor[];
}

export interface ExplanationClaim {
  claim: string;
  sourceModel: string;
  evidenceKeys: string[];
}

export interface InvestmentExplanation {
  summary: string;
  claims: ExplanationClaim[];
  confidence: InvestmentConfidence;
}

export interface PortfolioExposure {
  sport: string;
  era: CardEra;
  archetype: CardArchetype;
  playerName?: string;
  manufacturer?: string;
  grader?: string;
  weightPct: number;
}

export interface PortfolioConcentration {
  byPlayer: CardRiskLevel;
  bySport: CardRiskLevel;
  byEra: CardRiskLevel;
  byManufacturer: CardRiskLevel;
  byGrader: CardRiskLevel;
}

export interface PortfolioAnalysis {
  concentrationRisk: CardRiskLevel;
  diversificationScore: number;
  exposures: PortfolioExposure[];
  playerConcentration?: CardRiskLevel;
  sportConcentration?: CardRiskLevel;
  eraConcentration?: CardRiskLevel;
  manufacturerConcentration?: CardRiskLevel;
  graderConcentration?: CardRiskLevel;
  speculativeSharePct?: number;
  opportunities: string[];
  risks: string[];
  confidence: InvestmentConfidence;
}

export interface CardClassification {
  era: CardEra;
  archetype: CardArchetype;
  lifecycle: PlayerLifecycleStage;
  sportIndexId: string | null;
}

export interface CardSupplySignals {
  population?: number | null;
  populationGrowthPct?: number | null;
}

export interface CardInvestmentContext {
  asset: Asset;
  asOf: string;
  sales: MarketSale[];
  sportMarket: SportMarketSnapshot | null;
  classification: CardClassification;
  supply?: CardSupplySignals | null;
  manufacturer?: string | null;
  grader?: string | null;
}

export interface CardInvestmentProfile {
  assetId: string;
  modelVersion: string;
  computedAt: string;
  classification: CardClassification;
  valuation: CardMarketValuation;
  playerLegacy: PlayerLegacyScore;
  scarcity: ScarcityScore;
  demand: CardDemandScore;
  risk: CardRisk;
  seasonality: SeasonalityForecast;
  forecast: CardForecast;
  recommendation: InvestmentRecommendation;
  explanation: InvestmentExplanation;
  portfolio: PortfolioAnalysis;
  sportMarket: SportMarketSnapshot | null;
  inputs: Record<string, unknown>;
}

export interface CardInvestmentSnapshotRow {
  id: string;
  assetId: string;
  profile: CardInvestmentProfile;
  modelVersion: string;
  computedAt: string;
}
