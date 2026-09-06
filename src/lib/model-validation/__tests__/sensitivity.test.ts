import { describe, expect, it } from "vitest";
import { cloneContext, scorePlayer } from "@/lib/model-validation/helpers";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { markets } from "@/lib/model-validation/fixtures/markets";
import { makeCatalyst } from "@/lib/model-validation/fixtures/builders";
import { cardFixtures } from "@/lib/model-validation/fixtures/cards";
import { scoreCard } from "@/lib/model-validation/helpers";

describe("Player Opportunity sensitivity", () => {
  const baseline = () => playerFixtures.establishedSuperstar();

  it("performance/quality moves opportunity in the same direction", () => {
    const up = cloneContext(baseline());
    const down = cloneContext(baseline());
    up.qualitySignals = {
      ...up.qualitySignals!,
      careerStrength: 98,
      legacyStrength: 96,
      culturalRelevance: 95,
    };
    down.qualitySignals = {
      ...down.qualitySignals!,
      careerStrength: 25,
      legacyStrength: 22,
      culturalRelevance: 20,
    };
    expect(scorePlayer(up).opportunityScore).toBeGreaterThan(scorePlayer(baseline()).opportunityScore);
    expect(scorePlayer(down).opportunityScore).toBeLessThan(scorePlayer(baseline()).opportunityScore);
  });

  it("future outlook responds to injury, performance, and lifecycle", () => {
    const healthy = scorePlayer(playerFixtures.healthySuperstar());
    const injured = scorePlayer(playerFixtures.injuredSuperstar());
    const retired = scorePlayer(playerFixtures.retiredGreat());
    expect(injured.futureOutlookScore).toBeLessThan(healthy.futureOutlookScore);
    expect(retired.lifecycle).toBe("retired");
    expect(healthy.lifecycle).toBe("active");
  });

  it("demand moves opportunity in the same direction", () => {
    const up = cloneContext(baseline());
    const down = cloneContext(baseline());
    up.demandSignals = {
      ...up.demandSignals!,
      attentionScore: 90,
      sentimentScore: 88,
      searchInterestScore: 90,
      discussionGrowthScore: 86,
    };
    down.demandSignals = {
      ...down.demandSignals!,
      attentionScore: 20,
      sentimentScore: 18,
      searchInterestScore: 16,
      discussionGrowthScore: 14,
    };
    expect(scorePlayer(up).opportunityScore).toBeGreaterThan(scorePlayer(baseline()).opportunityScore);
    expect(scorePlayer(down).opportunityScore).toBeLessThan(scorePlayer(baseline()).opportunityScore);
  });

  it("sport market regime moves opportunity in the same direction", () => {
    const bull = cloneContext(baseline());
    const bear = cloneContext(baseline());
    bull.sportMarket = markets.bull;
    bear.sportMarket = markets.bear;
    expect(scorePlayer(bull).opportunityScore).toBeGreaterThan(scorePlayer(baseline()).opportunityScore);
    expect(scorePlayer(bear).opportunityScore).toBeLessThan(scorePlayer(baseline()).opportunityScore);
  });

  it("player momentum (growth/search) moves the score in the same direction", () => {
    const up = cloneContext(baseline());
    const down = cloneContext(baseline());
    up.demandSignals = {
      ...up.demandSignals!,
      discussionGrowthScore: 95,
      searchInterestScore: 92,
    };
    down.demandSignals = {
      ...down.demandSignals!,
      discussionGrowthScore: 8,
      searchInterestScore: 10,
    };
    expect(scorePlayer(up).opportunityScore).toBeGreaterThan(scorePlayer(baseline()).opportunityScore);
    expect(scorePlayer(down).opportunityScore).toBeLessThan(scorePlayer(baseline()).opportunityScore);
    expect(scorePlayer(up).momentumScore).toBeGreaterThan(scorePlayer(down).momentumScore);
  });

  it("catalysts move opportunity in the expected direction", () => {
    const up = cloneContext(baseline());
    const down = cloneContext(baseline());
    up.catalysts = [makeCatalyst({ direction: "positive", expectedMagnitude: 40 })];
    down.catalysts = [
      makeCatalyst({
        id: "neg",
        direction: "negative",
        expectedImpact: "negative",
        expectedMagnitude: 40,
      }),
    ];
    expect(scorePlayer(up).opportunityScore).toBeGreaterThan(scorePlayer(down).opportunityScore);
  });

  it("higher injury risk lowers opportunity", () => {
    const risky = cloneContext(baseline());
    const safer = cloneContext(baseline());
    risky.qualitySignals!.injuryRisk = 90;
    safer.qualitySignals!.injuryRisk = 5;
    expect(scorePlayer(risky).opportunityScore).toBeLessThan(scorePlayer(safer).opportunityScore);
    expect(scorePlayer(risky).riskScore).toBeGreaterThan(scorePlayer(safer).riskScore);
  });

  it("lower data quality reduces confidence without flipping the opportunity class", () => {
    const poor = cloneContext(baseline());
    poor.qualitySignals!.availableFieldCount = 1;
    poor.demandSignals!.sourceCount = 1;
    const base = scorePlayer(baseline());
    const degraded = scorePlayer(poor);
    expect(degraded.confidenceScore).toBeLessThan(base.confidenceScore);
    expect(Math.abs(degraded.opportunityScore - base.opportunityScore)).toBeLessThan(15);
  });
});

describe("Card opportunity property checks", () => {
  it("higher price versus constant fair value must not raise valuation score", () => {
    const cheap = scoreCard(cardFixtures.undervalued());
    const rich = scoreCard(cardFixtures.overpriced());
    expect(rich.valuationScore).toBeLessThanOrEqual(cheap.valuationScore);
  });

  it("higher scarcity must not reduce scarcity score", () => {
    expect(scoreCard(cardFixtures.scarceNumbered()).scarcityScore).toBeGreaterThanOrEqual(
      scoreCard(cardFixtures.highPopulation()).scarcityScore
    );
  });
});
