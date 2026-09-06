import type { ModelValidationScenario } from "@/lib/model-validation/types";

export const cardOpportunityScenarios: ModelValidationScenario[] = [
  {
    id: "card-A",
    name: "Fairly Valued Card",
    type: "player_card_opportunity",
    group: "card_opportunity",
    expectations: {
      playerOpportunityScore: { min: 55 },
      recommendation: { oneOf: ["buy", "hold", "strong_buy"] },
    },
  },
  {
    id: "card-B",
    name: "Severely Overpriced Card",
    type: "player_card_opportunity",
    group: "card_opportunity",
    notes: ["Must not inherit a high player score blindly."],
    expectations: {
      recommendation: { oneOf: ["hold", "sell", "strong_sell"] },
    },
    relative: [
      {
        field: "opportunityScore",
        otherScenario: "card-A",
        op: "lessThanScenario",
      },
    ],
  },
  {
    id: "card-C",
    name: "Undervalued Card",
    type: "player_card_opportunity",
    group: "card_opportunity",
    expectations: {
      recommendation: { oneOf: ["buy", "strong_buy", "hold"] },
    },
    relative: [
      {
        field: "opportunityScore",
        otherScenario: "card-A",
        op: "greaterThanScenario",
      },
      {
        field: "valuationScore",
        otherScenario: "card-B",
        op: "greaterThanScenario",
        minDelta: 10,
      },
    ],
  },
  {
    id: "card-D",
    name: "Low Liquidity Undervalued Card",
    type: "player_card_opportunity",
    group: "card_opportunity",
    expectations: {},
    relative: [
      {
        field: "opportunityScore",
        otherScenario: "card-C",
        op: "lessThanScenario",
      },
      {
        field: "liquidityScore",
        otherScenario: "card-C",
        op: "lessThanScenario",
      },
    ],
  },
  {
    id: "card-E",
    name: "High Population / Low Scarcity",
    type: "player_card_opportunity",
    group: "card_opportunity",
    expectations: {},
    relative: [
      {
        field: "scarcityScore",
        otherScenario: "card-scarce",
        op: "lessThanScenario",
      },
    ],
  },
];
