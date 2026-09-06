import { buildCardInvestmentContextSync } from "@/lib/card-investment/build-card-context";
import { VALIDATION_AS_OF } from "@/lib/model-validation/config";
import { makeAsset, makeSalesAround } from "@/lib/model-validation/fixtures/builders";
import { markets } from "@/lib/model-validation/fixtures/markets";
import { establishedSuperstarContext } from "@/lib/model-validation/fixtures/players";
import type { CardInvestmentContext } from "@/types/card-investment";
import type { PlayerOpportunityContext } from "@/types/player-opportunity";

export interface CardScenarioFixture {
  id: string;
  playerContext: PlayerOpportunityContext;
  cardContext: CardInvestmentContext;
}

function cardForPlayer(
  id: string,
  currentPrice: number,
  fairPrice: number,
  overrides: Parameters<typeof makeAsset>[0] = {},
  saleCount = 6,
  supply?: CardInvestmentContext["supply"]
): CardScenarioFixture {
  const playerContext = establishedSuperstarContext();
  const asset = makeAsset({
    id,
    player_name: playerContext.playerName,
    year: 2017,
    card_type: "Panini Prizm Base",
    ...overrides,
  });
  return {
    id,
    playerContext,
    cardContext: buildCardInvestmentContextSync(
      asset,
      makeSalesAround(currentPrice, fairPrice, saleCount),
      {
        asOf: VALIDATION_AS_OF,
        sportMarketOverride: playerContext.sportMarket,
        supply,
      }
    ),
  };
}

export const cardFixtures = {
  fairlyValued: () => cardForPlayer("card-fair", 1020, 1000),
  overpriced: () => cardForPlayer("card-over", 2000, 1050),
  undervalued: () => cardForPlayer("card-under", 700, 1000),
  lowLiquidity: () => cardForPlayer("card-thin", 700, 1000, {}, 2),
  highPopulation: () =>
    cardForPlayer(
      "card-common",
      700,
      1000,
      {
        card_type: "Panini Hoops Base",
        insert_parallel: null,
      },
      6,
      { population: 48000, populationGrowthPct: 22 }
    ),
  scarceNumbered: () =>
    cardForPlayer(
      "card-scarce",
      700,
      1000,
      {
        card_type: "Panini Prizm Gold",
        insert_parallel: "Gold /10",
      },
      6,
      { population: 12, populationGrowthPct: 2 }
    ),
};

export function cardWithMarket(
  fixture: CardScenarioFixture,
  sportMarket: CardInvestmentContext["sportMarket"]
): CardScenarioFixture {
  return {
    ...fixture,
    playerContext: { ...fixture.playerContext, sportMarket },
    cardContext: { ...fixture.cardContext, sportMarket },
  };
}

export function cardWithPhase(
  fixture: CardScenarioFixture,
  phase: string
): CardScenarioFixture {
  const sportMarket = fixture.cardContext.sportMarket
    ? { ...fixture.cardContext.sportMarket, seasonPhase: phase }
    : markets.neutral;
  return cardWithMarket(fixture, { ...sportMarket, seasonPhase: phase });
}
