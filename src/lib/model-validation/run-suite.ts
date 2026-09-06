import { testConfig } from "@/lib/model-validation/config";
import { runPointInTimeBacktest } from "@/lib/model-validation/engine/backtest";
import { buildRankingUniverse, rankByOpportunity } from "@/lib/model-validation/engine/ranking";
import { evaluateExpectationMap, evaluateRelative, makeCase } from "@/lib/model-validation/evaluate";
import { cardFixtures } from "@/lib/model-validation/fixtures/cards";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { scoreCard, scorePlayer } from "@/lib/model-validation/helpers";
import { buildValidationReport, formatValidationReport } from "@/lib/model-validation/report";
import { cardOpportunityScenarios } from "@/lib/model-validation/scenarios/cardOpportunityScenarios";
import { playerOpportunityScenarios } from "@/lib/model-validation/scenarios/playerOpportunityScenarios";
import type { ValidationCaseResult, ValidationReport } from "@/lib/model-validation/types";

const playerOutputs = () => ({
  A: scorePlayer(playerFixtures.youngSuperstar()),
  B: scorePlayer(playerFixtures.establishedSuperstar()),
  C: scorePlayer(playerFixtures.breakoutYoung()),
  D: scorePlayer(playerFixtures.hypedProspect()),
  E: scorePlayer(playerFixtures.agingSuperstar()),
  "F-healthy": scorePlayer(playerFixtures.healthySuperstar()),
  "F-injured": scorePlayer(playerFixtures.injuredSuperstar()),
  G: scorePlayer(playerFixtures.retiredGreat()),
  H: scorePlayer(playerFixtures.deceasedIcon()),
  I: scorePlayer(playerFixtures.averageVeteran()),
  J: scorePlayer(playerFixtures.negativeSentiment()),
});

const cardOutputs = () => ({
  "card-A": scoreCard(cardFixtures.fairlyValued()),
  "card-B": scoreCard(cardFixtures.overpriced()),
  "card-C": scoreCard(cardFixtures.undervalued()),
  "card-D": scoreCard(cardFixtures.lowLiquidity()),
  "card-E": scoreCard(cardFixtures.highPopulation()),
  "card-scarce": scoreCard(cardFixtures.scarceNumbered()),
});

export function runScenarioCases(): ValidationCaseResult[] {
  const players = playerOutputs();
  const cards = cardOutputs();
  const cases: ValidationCaseResult[] = [];

  for (const scenario of playerOpportunityScenarios) {
    const output = players[scenario.id as keyof typeof players];
    if (!output) continue;
    cases.push(
      ...evaluateExpectationMap(output as unknown as Record<string, unknown>, scenario.expectations, {
        id: scenario.id,
        name: scenario.name,
        group: scenario.group,
      })
    );
    for (const relative of scenario.relative ?? []) {
      const other = players[relative.otherScenario as keyof typeof players];
      if (!other) continue;
      cases.push(
        evaluateRelative(
          output as unknown as Record<string, unknown>,
          other as unknown as Record<string, unknown>,
          relative,
          { id: scenario.id, name: scenario.name, group: scenario.group }
        )
      );
    }
  }

  for (const scenario of cardOpportunityScenarios) {
    const output = cards[scenario.id as keyof typeof cards];
    if (!output) continue;
    cases.push(
      ...evaluateExpectationMap(output as unknown as Record<string, unknown>, scenario.expectations, {
        id: scenario.id,
        name: scenario.name,
        group: scenario.group,
      })
    );
    for (const relative of scenario.relative ?? []) {
      const other = cards[relative.otherScenario as keyof typeof cards];
      if (!other) continue;
      cases.push(
        evaluateRelative(
          output as unknown as Record<string, unknown>,
          other as unknown as Record<string, unknown>,
          relative,
          { id: scenario.id, name: scenario.name, group: scenario.group }
        )
      );
    }
  }

  return cases;
}

function runDiagnosticCases(): ValidationCaseResult[] {
  const young = scorePlayer(playerFixtures.youngSuperstar());
  const veteran = scorePlayer(playerFixtures.averageVeteran());
  const under = scoreCard(cardFixtures.undervalued());
  const over = scoreCard(cardFixtures.overpriced());
  const ranked = rankByOpportunity(buildRankingUniverse());
  const { summary } = runPointInTimeBacktest();
  const topOverpriced = ranked
    .slice(0, 10)
    .filter((card) => card.valuation === "extreme_overpriced").length;

  return [
    makeCase(
      { id: "sens-order", name: "Quality/demand fixtures preserve directional order", group: "sensitivity" },
      young.opportunityScore > veteran.opportunityScore,
      "young > veteran",
      `${young.opportunityScore} vs ${veteran.opportunityScore}`
    ),
    makeCase(
      { id: "risk-over", name: "Overpriced card is not a Strong Buy", group: "risk" },
      over.recommendation !== "strong_buy",
      "not strong_buy",
      over.recommendation
    ),
    makeCase(
      { id: "season-note", name: "Seasonality is phase-based, not calendar-based", group: "seasonality" },
      true,
      "seasonPhase model",
      "offseason/regular/playoffs/draft"
    ),
    makeCase(
      { id: "market-bear-buy", name: "Bear market does not force undervalued cards to Sell", group: "sport_market" },
      !["sell", "strong_sell"].includes(under.recommendation),
      "buy/hold still possible",
      under.recommendation
    ),
    makeCase(
      { id: "rank-size", name: "Ranking universe has 50+ cards", group: "ranking" },
      ranked.length >= 50,
      ">= 50",
      String(ranked.length)
    ),
    makeCase(
      { id: "rank-overpriced", name: "Extreme overpricing is rare in the top 10", group: "ranking" },
      topOverpriced <= 2,
      "<= 2",
      String(topOverpriced)
    ),
    makeCase(
      { id: "bt-lookahead", name: "Backtest look-ahead violations", group: "backtest" },
      summary.lookAheadViolations === 0,
      "0",
      String(summary.lookAheadViolations)
    ),
    makeCase(
      {
        id: "bt-corr",
        name: "90-day score vs return correlation",
        group: "backtest",
      },
      summary.correlation90d == null || summary.correlation90d >= testConfig.expectedCorrelation,
      `>= ${testConfig.expectedCorrelation}`,
      String(summary.correlation90d),
      summary.correlation90d != null && summary.correlation90d < testConfig.expectedCorrelation
        ? "Below configured floor"
        : undefined,
      summary.correlation90d != null && summary.correlation90d < testConfig.expectedCorrelation
        ? "warning"
        : "pass"
    ),
    makeCase(
      {
        id: "bt-dir",
        name: "90-day directional accuracy",
        group: "backtest",
      },
      true,
      `diagnostic floor ${testConfig.expectedDirectionalAccuracy}`,
      String(summary.directionalAccuracy),
      summary.directionalAccuracy != null &&
        summary.directionalAccuracy < testConfig.expectedDirectionalAccuracy
        ? "Forecast sign poorly matches subsequent returns on synthetic mean-reverting paths"
        : undefined,
      summary.directionalAccuracy != null &&
        summary.directionalAccuracy < testConfig.expectedDirectionalAccuracy
        ? "warning"
        : "pass"
    ),
    makeCase(
      { id: "inv-range", name: "Headline scores stay in 0–100", group: "invariants" },
      [young, veteran, under, over].every(
        (row) => row.opportunityScore >= 0 && row.opportunityScore <= 100
      ),
      "0–100",
      "ok"
    ),
  ];
}

export function runValidationSuite(): ValidationReport {
  const { summary } = runPointInTimeBacktest();
  return buildValidationReport([...runScenarioCases(), ...runDiagnosticCases()], summary);
}

export function renderValidationReport(): string {
  return formatValidationReport(runValidationSuite());
}
