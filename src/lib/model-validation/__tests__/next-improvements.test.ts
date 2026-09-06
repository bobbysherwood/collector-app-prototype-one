import { describe, expect, it } from "vitest";
import { currentMarketValueFromSales } from "@/lib/card-investment/valuation/current-price";
import { VALIDATION_AS_OF } from "@/lib/model-validation/config";
import { runPointInTimeBacktest } from "@/lib/model-validation/engine/backtest";
import { assertValidationOnly, frozenCalibratedWeights } from "@/lib/model-validation/engine/calibrate-weights";
import {
  historicalSeriesToObserved,
  runObservedSalesBacktest,
} from "@/lib/model-validation/engine/observed-sales-backtest";
import { buildSyntheticHistoricalUniverse } from "@/lib/model-validation/engine/backtest";
import { makeSale } from "@/lib/model-validation/fixtures/builders";
import { cardFixtures } from "@/lib/model-validation/fixtures/cards";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { scoreCard, scorePlayer } from "@/lib/model-validation/helpers";
import { classifyPlayerOpportunityLifecycle } from "@/lib/player-opportunity/classification/lifecycle";
import { classifyPlayerLifecycle } from "@/lib/card-investment/classification/player-lifecycle";
import { makeAsset } from "@/lib/model-validation/fixtures/builders";
import { constrainRecommendation, recommendationFromScore } from "@/lib/player-opportunity/weights/profiles";

describe("Named risk fields", () => {
  it("separates permanent-loss risk, player risk, volatility, and uncertainty", () => {
    const under = scoreCard(cardFixtures.undervalued());
    const over = scoreCard(cardFixtures.overpriced());
    expect(over.riskScore).toBeGreaterThan(under.riskScore);
    expect(over.playerRiskScore).toBe(under.playerRiskScore);
    expect(over.volatilityScore).not.toBe(over.riskScore);
    expect(over.uncertaintyScore).toBe(100 - over.confidenceScore);
  });
});

describe("Current price observation", () => {
  it("uses the latest in-window sale rather than array order", () => {
    const older = makeSale(500, 20);
    const newer = makeSale(900, 2);
    expect(currentMarketValueFromSales([older, newer], VALIDATION_AS_OF)).toBe(900);
    expect(currentMarketValueFromSales([newer, older], VALIDATION_AS_OF)).toBe(900);
  });
});

describe("Player profile overrides name heuristics", () => {
  it("treats an explicit active profile as active even for a retired-list name", () => {
    const lebron = makeAsset({ player_name: "LeBron James", year: 2003, card_type: "Topps Chrome" });
    const heuristic = classifyPlayerOpportunityLifecycle(
      lebron,
      classifyPlayerLifecycle(lebron, 2026),
      2026
    );
    const explicit = classifyPlayerOpportunityLifecycle(
      lebron,
      classifyPlayerLifecycle(lebron, 2026),
      2026,
      { careerStatus: "active", birthYear: 1984 }
    );
    expect(heuristic).toBe("retired");
    expect(explicit).toBe("active");
  });
});

describe("Recommendation constraints", () => {
  it("blocks Strong Buy when confidence is low or the card is rich", () => {
    expect(
      constrainRecommendation("strong_buy", {
        confidenceScore: 40,
        priceToFairValueRatio: 1,
        marginOfSafety: 0,
      })
    ).toBe("buy");
    expect(
      constrainRecommendation("buy", {
        confidenceScore: 80,
        priceToFairValueRatio: 1.2,
        marginOfSafety: -20,
      })
    ).toBe("hold");
    expect(
      constrainRecommendation("sell", {
        confidenceScore: 80,
        priceToFairValueRatio: 0.7,
        marginOfSafety: 30,
      })
    ).toBe("hold");
  });

  it("still maps raw scores at the official thresholds", () => {
    expect(recommendationFromScore(80)).toBe("strong_buy");
    expect(recommendationFromScore(64)).toBe("hold");
  });
});

describe("Observed-sales backtest and calibration policy", () => {
  it("replays observed prints without look-ahead", () => {
    const { observations, lookAheadViolations } = runObservedSalesBacktest(
      buildSyntheticHistoricalUniverse().map(historicalSeriesToObserved)
    );
    expect(lookAheadViolations).toBe(0);
    expect(observations.length).toBeGreaterThan(10);
    expect(observations.some((row) => row.actualReturn90d != null)).toBe(true);
  });

  it("refuses to calibrate on holdout rows", () => {
    const { observations } = runPointInTimeBacktest();
    expect(() => assertValidationOnly(observations.filter((row) => row.split === "holdout"))).toThrow(
      /holdout/
    );
    expect(frozenCalibratedWeights().expectedReturn).toBeGreaterThan(0.1);
    const validation = observations.filter((row) => row.split !== "holdout");
    expect(() => assertValidationOnly(validation)).not.toThrow();
  });
});

describe("Player opportunity stays independent of card price", () => {
  it("does not copy card fair value onto the player result", () => {
    const player = scorePlayer(playerFixtures.establishedSuperstar());
    expect(player.referenceFairValue).toBeNull();
  });
});

describe("Contribution explanations do not invent unused factors", () => {
  it("does not claim valuation helped an overpriced card", () => {
    const over = scoreCard(cardFixtures.overpriced());
    expect(over.positiveDrivers.join(" ")).not.toMatch(/valuation versus fair value is supporting/i);
    expect(over.valuationScore).toBeLessThan(40);
  });
});
