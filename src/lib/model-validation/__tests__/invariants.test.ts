import { describe, expect, it } from "vitest";
import { cardFixtures } from "@/lib/model-validation/fixtures/cards";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { cloneContext, scoreCard, scorePlayer } from "@/lib/model-validation/helpers";

const RECS = ["strong_buy", "buy", "hold", "sell", "strong_sell"] as const;

describe("Model invariants", () => {
  const players = Object.values(playerFixtures).map((factory) => scorePlayer(factory()));
  const cards = [
    scoreCard(cardFixtures.fairlyValued()),
    scoreCard(cardFixtures.overpriced()),
    scoreCard(cardFixtures.undervalued()),
    scoreCard(cardFixtures.lowLiquidity()),
    scoreCard(cardFixtures.highPopulation()),
    scoreCard(cardFixtures.scarceNumbered()),
  ];

  it("keeps core scores in 0–100 and values non-negative", () => {
    for (const player of players) {
      for (const score of [
        player.opportunityScore,
        player.riskScore,
        player.confidenceScore,
        player.qualityScore,
        player.demandScore,
      ]) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
    for (const card of cards) {
      expect(card.opportunityScore).toBeGreaterThanOrEqual(0);
      expect(card.opportunityScore).toBeLessThanOrEqual(100);
      expect(card.riskScore).toBeGreaterThanOrEqual(0);
      expect(card.playerRiskScore).toBeGreaterThanOrEqual(0);
      expect(card.uncertaintyScore).toBeGreaterThanOrEqual(0);
      expect(card.uncertaintyScore).toBeLessThanOrEqual(100);
      expect(card.confidenceScore).toBeLessThanOrEqual(100);
      expect(card.currentMarketValue).toBeGreaterThanOrEqual(0);
      expect(card.fairMarketValue).toBeGreaterThanOrEqual(0);
      expect(card.expectedValue90d).toBeGreaterThanOrEqual(0);
      expect(RECS).toContain(card.recommendation);
    }
  });

  it("higher valuation premium does not improve valuation score", () => {
    expect(scoreCard(cardFixtures.overpriced()).valuationScore).toBeLessThan(
      scoreCard(cardFixtures.undervalued()).valuationScore
    );
  });

  it("higher scarcity does not reduce scarcity score", () => {
    expect(scoreCard(cardFixtures.scarceNumbered()).scarcityScore).toBeGreaterThanOrEqual(
      scoreCard(cardFixtures.highPopulation()).scarcityScore
    );
  });

  it("higher player risk does not improve risk-adjusted card opportunity", () => {
    const base = cardFixtures.undervalued();
    const riskyPlayer = cloneContext(base.playerContext);
    riskyPlayer.qualitySignals = { ...riskyPlayer.qualitySignals!, injuryRisk: 95 };
    const safe = scoreCard(base);
    const risky = scoreCard({ ...base, playerContext: riskyPlayer });
    expect(risky.riskAdjustedReturnScore).toBeLessThanOrEqual(safe.riskAdjustedReturnScore);
  });

  it("better liquidity does not reduce liquidity score", () => {
    expect(scoreCard(cardFixtures.undervalued()).liquidityScore).toBeGreaterThanOrEqual(
      scoreCard(cardFixtures.lowLiquidity()).liquidityScore
    );
  });

  it("missing data does not increase confidence", () => {
    const full = scorePlayer(playerFixtures.establishedSuperstar());
    const missing = cloneContext(playerFixtures.establishedSuperstar());
    missing.demandSignals!.sourceCount = 0;
    missing.qualitySignals!.availableFieldCount = 0;
    expect(scorePlayer(missing).confidenceScore).toBeLessThanOrEqual(full.confidenceScore);
  });
});
