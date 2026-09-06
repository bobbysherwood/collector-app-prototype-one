import { describe, expect, it } from "vitest";
import { computeCardRisk } from "@/lib/card-investment/risk/card-risk-model";
import { computeCardValuation } from "@/lib/card-investment/valuation/card-valuation-model";
import { resolveWeightProfile } from "@/lib/card-investment/weights/profiles";
import { computePortfolioAnalysis } from "@/lib/card-investment/portfolio/portfolio-risk-model";
import { cardWithMarket } from "@/lib/model-validation/fixtures/cards";
import { cardFixtures } from "@/lib/model-validation/fixtures/cards";
import { makeAsset, makeSale, makeSalesAround } from "@/lib/model-validation/fixtures/builders";
import { markets } from "@/lib/model-validation/fixtures/markets";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { cloneContext, scoreCard, scorePlayer } from "@/lib/model-validation/helpers";
import { VALIDATION_AS_OF } from "@/lib/model-validation/config";
import { buildCardInvestmentContextSync } from "@/lib/card-investment/build-card-context";

function weightsFor(context: ReturnType<typeof cardFixtures.undervalued>["cardContext"]) {
  return resolveWeightProfile({
    sport: context.asset.sport,
    era: context.classification.era,
    lifecycle: context.classification.lifecycle,
    archetype: context.classification.archetype,
  });
}

describe("Card risk", () => {
  it("treats volatility, liquidity, and sport risk as distinct inputs", () => {
    const stable = cardFixtures.undervalued().cardContext;
    const volatileSales = [
      makeSale(400, 2),
      makeSale(1600, 8),
      makeSale(500, 14),
      makeSale(1500, 20),
      makeSale(700, 26),
      makeSale(1400, 32),
    ];
    const volatile = buildCardInvestmentContextSync(stable.asset, volatileSales, {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.neutral,
    });
    const w = weightsFor(stable);
    const stableRisk = computeCardRisk(stable, computeCardValuation(stable, w), w);
    const volatileRisk = computeCardRisk(volatile, computeCardValuation(volatile, w), w);
    expect(volatileRisk.volatilityScore).toBeGreaterThan(stableRisk.volatilityScore);

    const thin = cardFixtures.lowLiquidity().cardContext;
    const liquid = cardFixtures.undervalued().cardContext;
    const thinRisk = computeCardRisk(thin, computeCardValuation(thin, weightsFor(thin)), weightsFor(thin));
    const liquidRisk = computeCardRisk(liquid, computeCardValuation(liquid, w), w);
    expect(thinRisk.liquidityScore).toBeLessThan(liquidRisk.liquidityScore);
  });
});

describe("Player risk", () => {
  it("injury, prospect status, and sport risk raise player risk independently", () => {
    const healthy = scorePlayer(playerFixtures.healthySuperstar());
    const injured = scorePlayer(playerFixtures.injuredSuperstar());
    const prospect = scorePlayer(playerFixtures.hypedProspect());
    const bear = cloneContext(playerFixtures.establishedSuperstar());
    bear.sportMarket = markets.bear;
    expect(injured.riskScore).toBeGreaterThan(healthy.riskScore);
    expect(prospect.riskScore).toBeGreaterThan(scorePlayer(playerFixtures.establishedSuperstar()).riskScore);
    expect(scorePlayer(bear).riskScore).toBeGreaterThan(
      scorePlayer(playerFixtures.establishedSuperstar()).riskScore
    );
  });
});

describe("Sport risk", () => {
  it("bearish sport risk rating is worse than a bull market", () => {
    const bull = scoreCard(cardWithMarket(cardFixtures.undervalued(), markets.bull));
    const bear = scoreCard(cardWithMarket(cardFixtures.undervalued(), markets.bear));
    expect(bear.opportunityScore).toBeLessThanOrEqual(bull.opportunityScore);
  });
});

describe("Portfolio risk", () => {
  it("flags concentration across player/sport/era/archetype buckets", () => {
    const star = cardFixtures.undervalued().cardContext;
    const peers = Array.from({ length: 6 }, (_, index) =>
      buildCardInvestmentContextSync(
        makeAsset({
          id: `peer-${index}`,
          player_name: "Jayson Tatum",
          year: 2017,
          card_type: "Panini Prizm Base",
        }),
        makeSalesAround(1000, 1000),
        { asOf: VALIDATION_AS_OF, sportMarketOverride: markets.neutral }
      )
    );
    const concentrated = computePortfolioAnalysis({ context: star, peerContexts: peers.slice(0, 1) });
    const diversified = computePortfolioAnalysis({
      context: star,
      peerContexts: [
        buildCardInvestmentContextSync(
          makeAsset({
            id: "vintage-peer",
            player_name: "Michael Jordan",
            year: 1986,
            card_type: "Fleer Rookie",
          }),
          makeSalesAround(5000, 5000),
          { asOf: VALIDATION_AS_OF, sportMarketOverride: markets.neutral }
        ),
        buildCardInvestmentContextSync(
          makeAsset({
            id: "rookie-peer",
            player_name: "Anthony Edwards",
            year: 2024,
            card_type: "Panini Prizm Rookie",
            insert_parallel: "Silver",
          }),
          makeSalesAround(200, 200),
          { asOf: VALIDATION_AS_OF, sportMarketOverride: markets.neutral }
        ),
      ],
    });
    expect(concentrated.concentrationRisk === "high" || concentrated.diversificationScore <= 50).toBe(
      true
    );
    expect(diversified.exposures.length).toBeGreaterThan(concentrated.exposures.length);
    expect(diversified.exposures.length).toBeGreaterThan(1);
  });
});

describe("Volatility vs risk vs uncertainty", () => {
  it("does not treat volatility, permanent-loss risk, and uncertainty as the same score", () => {
    const liquidVolatile = buildCardInvestmentContextSync(
      makeAsset({ id: "vol-low-risk", player_name: "Jayson Tatum", year: 2017 }),
      [400, 1600, 500, 1500, 600, 1400, 700, 1300].map((price, index) => makeSale(price, 2 + index * 4)),
      { asOf: VALIDATION_AS_OF, sportMarketOverride: markets.bull }
    );
    const w = weightsFor(liquidVolatile);
    const volRisk = computeCardRisk(liquidVolatile, computeCardValuation(liquidVolatile, w), w);
    const injured = scorePlayer(playerFixtures.injuredSuperstar());
    const thin = scoreCard(cardFixtures.lowLiquidity());
    const richCertain = scoreCard(cardFixtures.overpriced());

    expect(volRisk.volatilityScore).toBeGreaterThan(20);
    expect(injured.riskScore).toBeGreaterThan(40);
    expect(thin.confidenceScore).toBeLessThan(richCertain.confidenceScore);
    expect(thin.valuationScore).toBeGreaterThan(richCertain.valuationScore);
    expect(volRisk.volatilityScore).not.toBe(volRisk.liquidityScore);
    expect(thin.confidenceScore).not.toBe(thin.volatilityScore);
    expect(richCertain.playerRiskScore).not.toBe(richCertain.volatilityScore);
    expect(richCertain.uncertaintyScore).not.toBe(richCertain.volatilityScore);
    expect(injured.riskScore).toBeGreaterThan(0);
  });
});
