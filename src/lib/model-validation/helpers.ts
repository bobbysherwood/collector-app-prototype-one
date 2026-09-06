import {
  diagnosePlayerCardOpportunity,
  diagnosePlayerOpportunity,
} from "@/lib/model-validation/diagnostics";
import type { CardScenarioFixture } from "@/lib/model-validation/fixtures/cards";
import { computePlayerCardOpportunity } from "@/lib/player-card-opportunity/player-card-opportunity-model";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import type { CardInvestmentContext } from "@/types/card-investment";
import type {
  PlayerCardOpportunity,
  PlayerOpportunity,
  PlayerOpportunityContext,
} from "@/types/player-opportunity";

export function scorePlayer(
  context: PlayerOpportunityContext,
  cardContext?: CardInvestmentContext
): PlayerOpportunity {
  return computePlayerOpportunity(context, cardContext);
}

export function scoreCard(fixture: CardScenarioFixture): PlayerCardOpportunity {
  return computePlayerCardOpportunity({
    cardContext: fixture.cardContext,
    playerContext: fixture.playerContext,
  });
}

export function scoreCardWithPlayer(
  fixture: CardScenarioFixture,
  playerOpportunity: PlayerOpportunity
): PlayerCardOpportunity {
  return computePlayerCardOpportunity({
    cardContext: fixture.cardContext,
    playerContext: fixture.playerContext,
    playerOpportunity,
  });
}

export function inspectPlayer(context: PlayerOpportunityContext) {
  return diagnosePlayerOpportunity(context);
}

export function inspectCard(fixture: CardScenarioFixture) {
  return diagnosePlayerCardOpportunity({
    cardContext: fixture.cardContext,
    playerContext: fixture.playerContext,
  });
}

export function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function cloneContext<T>(value: T): T {
  return structuredClone(value);
}
