import { describe, expect, it } from "vitest";
import { testConfig } from "@/lib/model-validation/config";
import { cardFixtures } from "@/lib/model-validation/fixtures/cards";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { scoreCard, scorePlayer } from "@/lib/model-validation/helpers";

/**
 * Relative regression locks. Exact scores are allowed to drift inside
 * testConfig.scoreTolerance when the change is documented. These relations
 * are the validated behavior that must not invert silently.
 */
describe("Regression suite", () => {
  const young = scorePlayer(playerFixtures.youngSuperstar());
  const established = scorePlayer(playerFixtures.establishedSuperstar());
  const veteran = scorePlayer(playerFixtures.averageVeteran());
  const aging = scorePlayer(playerFixtures.agingSuperstar());
  const hyped = scorePlayer(playerFixtures.hypedProspect());
  const healthy = scorePlayer(playerFixtures.healthySuperstar());
  const injured = scorePlayer(playerFixtures.injuredSuperstar());
  const fair = scoreCard(cardFixtures.fairlyValued());
  const over = scoreCard(cardFixtures.overpriced());
  const under = scoreCard(cardFixtures.undervalued());

  it("preserves player opportunity ordering", () => {
    expect(young.opportunityScore).toBeGreaterThan(veteran.opportunityScore);
    expect(established.opportunityScore).toBeGreaterThan(veteran.opportunityScore);
    expect(aging.opportunityScore).toBeLessThan(established.opportunityScore);
    expect(injured.opportunityScore).toBeLessThan(healthy.opportunityScore);
    expect(hyped.demandScore).toBeGreaterThan(hyped.qualityScore);
  });

  it("preserves card opportunity ordering", () => {
    expect(under.opportunityScore).toBeGreaterThan(over.opportunityScore);
    expect(under.valuationScore).toBeGreaterThan(fair.valuationScore);
    expect(fair.valuationScore).toBeGreaterThan(over.valuationScore);
    expect(over.opportunityScore).toBeLessThan(over.playerOpportunityScore);
  });

  it("does not fail merely because a score moved inside tolerance", () => {
    const priorYoung = young.opportunityScore;
    expect(Math.abs(young.opportunityScore - priorYoung)).toBeLessThanOrEqual(
      testConfig.scoreTolerance
    );
  });

  it("keeps recommendation families stable for the locked fixtures", () => {
    expect(["buy", "strong_buy", "hold"]).toContain(under.recommendation);
    expect(["hold", "sell", "strong_sell"]).toContain(over.recommendation);
  });
});
