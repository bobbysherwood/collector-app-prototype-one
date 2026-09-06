import { computeCardDemandScore } from "@/lib/card-investment/demand/card-demand-model";
import { computeCardRisk } from "@/lib/card-investment/risk/card-risk-model";
import { computeScarcityScore } from "@/lib/card-investment/scarcity/card-scarcity-model";
import { computeCardValuation } from "@/lib/card-investment/valuation/card-valuation-model";
import { resolveWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  PlayerCardOpportunityDiagnostics,
  PlayerOpportunityDiagnostics,
} from "@/lib/model-validation/types";
import { computeMispricing } from "@/lib/player-card-opportunity/mispricing";
import {
  computePlayerCardOpportunity,
  type PlayerCardOpportunityInput,
} from "@/lib/player-card-opportunity/player-card-opportunity-model";
import { classifyPlayerOpportunityLifecycle } from "@/lib/player-opportunity/classification/lifecycle";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import { catalystImpactScore } from "@/lib/player-opportunity/player-opportunity-scoring";
import {
  resolvePlayerCardOpportunityWeights,
  resolvePlayerOpportunityWeights,
} from "@/lib/player-opportunity/weights/profiles";
import type { CardInvestmentContext } from "@/types/card-investment";
import type { PlayerOpportunityContext } from "@/types/player-opportunity";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function diagnosePlayerOpportunity(
  context: PlayerOpportunityContext,
  cardContext?: CardInvestmentContext
): PlayerOpportunityDiagnostics {
  const result = computePlayerOpportunity(context, cardContext);
  const weights = resolvePlayerOpportunityWeights(context.lifecycle);
  const catalystScore = catalystImpactScore(result.catalysts);
  const total =
    weights.playerQuality +
    weights.futureOutlook +
    weights.demand +
    weights.sportMarket +
    weights.momentum +
    weights.catalysts;

  const components = {
    quality: result.qualityScore,
    futureOutlook: result.futureOutlookScore,
    demand: result.demandScore,
    sportMarket: result.sportMarketScore,
    momentum: result.momentumScore,
    catalysts: catalystScore,
  };

  return {
    result,
    components,
    weightedContributions: {
      quality: round2((components.quality * weights.playerQuality) / total),
      futureOutlook: round2((components.futureOutlook * weights.futureOutlook) / total),
      demand: round2((components.demand * weights.demand) / total),
      sportMarket: round2((components.sportMarket * weights.sportMarket) / total),
      momentum: round2((components.momentum * weights.momentum) / total),
      catalysts: round2((components.catalysts * weights.catalysts) / total),
    },
  };
}

export function diagnosePlayerCardOpportunity(
  input: PlayerCardOpportunityInput
): PlayerCardOpportunityDiagnostics {
  const result = computePlayerCardOpportunity(input);
  const { cardContext, playerContext } = input;
  const cardWeights = resolveWeightProfile({
    sport: cardContext.asset.sport,
    era: cardContext.classification.era,
    lifecycle: cardContext.classification.lifecycle,
    archetype: cardContext.classification.archetype,
  });
  const lifecycle = classifyPlayerOpportunityLifecycle(
    cardContext.asset,
    cardContext.classification.lifecycle,
    new Date(cardContext.asOf).getFullYear(),
    playerContext.playerProfile
  );
  const weights = resolvePlayerCardOpportunityWeights({
    era: cardContext.classification.era,
    archetype: cardContext.classification.archetype,
    lifecycle,
  });
  const valuation = computeCardValuation(cardContext, cardWeights);
  const scarcity = computeScarcityScore(cardContext, cardWeights);
  const demand = computeCardDemandScore(cardContext, valuation, cardWeights);
  void computeCardRisk(cardContext, valuation, cardWeights);

  const total =
    weights.playerOpportunity +
    weights.valuation +
    weights.scarcity +
    weights.demand +
    weights.expectedReturn +
    weights.riskAdjustedReturn +
    weights.liquidity;

  const components = {
    playerOpportunity: result.playerOpportunityScore,
    valuation: result.valuationScore,
    scarcity: result.scarcityScore,
    demandMomentum: result.demandScore,
    expectedReturn: result.returnScore,
    riskAdjustedReturn: result.riskAdjustedReturnScore,
    liquidity: result.liquidityScore,
  };

  return {
    result,
    components,
    weightedContributions: {
      playerOpportunity: round2(
        (components.playerOpportunity * weights.playerOpportunity) / total
      ),
      valuation: round2((components.valuation * weights.valuation) / total),
      scarcity: round2((components.scarcity * weights.scarcity) / total),
      demandMomentum: round2((components.demandMomentum * weights.demand) / total),
      expectedReturn: round2((components.expectedReturn * weights.expectedReturn) / total),
      riskAdjustedReturn: round2(
        (components.riskAdjustedReturn * weights.riskAdjustedReturn) / total
      ),
      liquidity: round2((components.liquidity * weights.liquidity) / total),
    },
  };
}

export function inspectMispricing(current: number, fair: number) {
  return computeMispricing(current, fair);
}
