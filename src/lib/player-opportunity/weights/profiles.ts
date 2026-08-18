import type {
  PlayerCardOpportunityWeightProfile,
  PlayerOpportunityLifecycle,
  PlayerOpportunityWeightProfile,
} from "@/types/player-opportunity";
import type { CardArchetype, CardEra } from "@/types/card-investment";
import type { OpportunityThresholds } from "@/types/player-opportunity";

export const DEFAULT_PLAYER_OPPORTUNITY_WEIGHTS: PlayerOpportunityWeightProfile = {
  id: "default",
  label: "Default",
  playerQuality: 0.3,
  futureOutlook: 0.2,
  demand: 0.2,
  sportMarket: 0.15,
  momentum: 0.1,
  catalysts: 0.05,
};

const LIFECYCLE_PLAYER_WEIGHTS: Record<
  PlayerOpportunityLifecycle,
  PlayerOpportunityWeightProfile
> = {
  prospect: {
    ...DEFAULT_PLAYER_OPPORTUNITY_WEIGHTS,
    id: "prospect",
    label: "Prospect",
    playerQuality: 0.2,
    futureOutlook: 0.25,
    demand: 0.25,
    momentum: 0.15,
    catalysts: 0.05,
    sportMarket: 0.1,
  },
  active: DEFAULT_PLAYER_OPPORTUNITY_WEIGHTS,
  retired: {
    ...DEFAULT_PLAYER_OPPORTUNITY_WEIGHTS,
    id: "retired",
    label: "Retired",
    playerQuality: 0.35,
    futureOutlook: 0.15,
    demand: 0.2,
    momentum: 0.05,
    catalysts: 0.1,
    sportMarket: 0.15,
  },
  deceased: {
    ...DEFAULT_PLAYER_OPPORTUNITY_WEIGHTS,
    id: "deceased",
    label: "Deceased",
    playerQuality: 0.4,
    futureOutlook: 0.1,
    demand: 0.2,
    momentum: 0.05,
    catalysts: 0.1,
    sportMarket: 0.15,
  },
};

export const DEFAULT_PLAYER_CARD_WEIGHTS: PlayerCardOpportunityWeightProfile = {
  id: "default",
  label: "Default",
  playerOpportunity: 0.25,
  valuation: 0.25,
  scarcity: 0.15,
  demand: 0.1,
  expectedReturn: 0.1,
  riskAdjustedReturn: 0.1,
  liquidity: 0.05,
};

const VINTAGE_PLAYER_CARD_WEIGHTS: PlayerCardOpportunityWeightProfile = {
  ...DEFAULT_PLAYER_CARD_WEIGHTS,
  id: "vintage",
  label: "Vintage",
  playerOpportunity: 0.2,
  valuation: 0.2,
  scarcity: 0.25,
  liquidity: 0.1,
  demand: 0.1,
  expectedReturn: 0.08,
  riskAdjustedReturn: 0.07,
};

const ULTRA_MODERN_PLAYER_CARD_WEIGHTS: PlayerCardOpportunityWeightProfile = {
  ...DEFAULT_PLAYER_CARD_WEIGHTS,
  id: "ultra-modern",
  label: "Ultra-Modern",
  playerOpportunity: 0.28,
  valuation: 0.22,
  scarcity: 0.12,
  demand: 0.15,
  expectedReturn: 0.12,
  riskAdjustedReturn: 0.08,
  liquidity: 0.03,
};

export const DEFAULT_OPPORTUNITY_THRESHOLDS: OpportunityThresholds = {
  strongBuy: 80,
  buy: 65,
  hold: 45,
  sell: 30,
};

export function resolvePlayerOpportunityWeights(
  lifecycle: PlayerOpportunityLifecycle
): PlayerOpportunityWeightProfile {
  return LIFECYCLE_PLAYER_WEIGHTS[lifecycle] ?? DEFAULT_PLAYER_OPPORTUNITY_WEIGHTS;
}

export function resolvePlayerCardOpportunityWeights(input: {
  era: CardEra;
  archetype: CardArchetype;
  lifecycle: PlayerOpportunityLifecycle;
}): PlayerCardOpportunityWeightProfile {
  if (input.era === "vintage") return VINTAGE_PLAYER_CARD_WEIGHTS;
  if (input.era === "ultra_modern") return ULTRA_MODERN_PLAYER_CARD_WEIGHTS;
  if (input.archetype === "rookie" && input.lifecycle === "prospect") {
    return {
      ...DEFAULT_PLAYER_CARD_WEIGHTS,
      id: "modern-rookie",
      label: "Modern Rookie",
      playerOpportunity: 0.28,
      demand: 0.12,
      expectedReturn: 0.12,
    };
  }
  return DEFAULT_PLAYER_CARD_WEIGHTS;
}

export function recommendationFromScore(
  score: number,
  thresholds: OpportunityThresholds = DEFAULT_OPPORTUNITY_THRESHOLDS
): import("@/types/player-opportunity").PlayerCardRecommendation {
  if (score >= thresholds.strongBuy) return "strong_buy";
  if (score >= thresholds.buy) return "buy";
  if (score >= thresholds.hold) return "hold";
  if (score >= thresholds.sell) return "sell";
  return "strong_sell";
}

export function listPlayerOpportunityWeightProfiles(): PlayerOpportunityWeightProfile[] {
  return Object.values(LIFECYCLE_PLAYER_WEIGHTS);
}

export function listPlayerCardOpportunityWeightProfiles(): PlayerCardOpportunityWeightProfile[] {
  return [
    DEFAULT_PLAYER_CARD_WEIGHTS,
    VINTAGE_PLAYER_CARD_WEIGHTS,
    ULTRA_MODERN_PLAYER_CARD_WEIGHTS,
    {
      ...DEFAULT_PLAYER_CARD_WEIGHTS,
      id: "modern-rookie",
      label: "Modern Rookie",
      playerOpportunity: 0.28,
      demand: 0.12,
      expectedReturn: 0.12,
    },
  ];
}
