import type { ModelValidationScenario } from "@/lib/model-validation/types";

export const playerOpportunityScenarios: ModelValidationScenario[] = [
  {
    id: "A",
    name: "Young Superstar Improving",
    type: "player_opportunity",
    group: "player_opportunity",
    expectations: {
      opportunityScore: { min: 70 },
      trend: { oneOf: ["increasing", "strongly_increasing"] },
      confidenceScore: { min: 70 },
      riskScore: { max: 65 },
      futureOutlookScore: { min: 65 },
    },
    relative: [
      { field: "opportunityScore", otherScenario: "B", op: "greaterThanScenario" },
      { field: "opportunityScore", otherScenario: "I", op: "greaterThanScenario", minDelta: 10 },
      { field: "opportunityScore", otherScenario: "E", op: "greaterThanScenario" },
    ],
  },
  {
    id: "B",
    name: "Established Superstar Stable",
    type: "player_opportunity",
    group: "player_opportunity",
    expectations: {
      opportunityScore: { min: 55 },
      trend: { oneOf: ["neutral", "increasing", "strongly_increasing"] },
      confidenceScore: { min: 70 },
    },
    relative: [
      {
        field: "momentumScore",
        otherScenario: "A",
        op: "lessThanScenario",
      },
    ],
  },
  {
    id: "C",
    name: "Breakout Young Player",
    type: "player_opportunity",
    group: "player_opportunity",
    expectations: {
      opportunityScore: { min: 60 },
      confidenceScore: { min: 50 },
    },
    relative: [
      { field: "confidenceScore", otherScenario: "B", op: "lessThanScenario" },
    ],
  },
  {
    id: "D",
    name: "Hyped Prospect With Weak Fundamentals",
    type: "player_opportunity",
    group: "player_opportunity",
    notes: [
      "Hype must not produce an extremely high-confidence opportunity score.",
    ],
    expectations: {
      opportunityScore: { min: 45, max: 85 },
      demandScore: { min: 65 },
      qualityScore: { max: 70 },
      riskScore: { min: 45 },
    },
    relative: [
      { field: "confidenceScore", otherScenario: "B", op: "lessThanScenario" },
    ],
  },
  {
    id: "E",
    name: "Aging Superstar Declining",
    type: "player_opportunity",
    group: "player_opportunity",
    notes: [
      "Trend is derived from demand/sport momentum, not on-court decline.",
    ],
    expectations: {
      qualityScore: { min: 60 },
      futureOutlookScore: { max: 65 },
    },
    relative: [
      { field: "opportunityScore", otherScenario: "B", op: "lessThanScenario" },
      { field: "riskScore", otherScenario: "B", op: "greaterThanScenario" },
    ],
  },
  {
    id: "F-healthy",
    name: "Injured Superstar — Healthy",
    type: "player_opportunity",
    group: "player_opportunity",
    expectations: {
      opportunityScore: { min: 60 },
      riskScore: { max: 55 },
    },
  },
  {
    id: "F-injured",
    name: "Injured Superstar — Injured",
    type: "player_opportunity",
    group: "player_opportunity",
    notes: [
      "Injury lowers future outlook, raises risk, and reduces the opportunity score.",
    ],
    expectations: {},
    relative: [
      {
        field: "opportunityScore",
        otherScenario: "F-healthy",
        op: "lessThanScenario",
      },
      { field: "riskScore", otherScenario: "F-healthy", op: "greaterThanScenario" },
    ],
  },
  {
    id: "G",
    name: "Retired All-Time Great",
    type: "player_opportunity",
    group: "player_opportunity",
    expectations: {
      opportunityScore: { min: 60 },
      qualityScore: { min: 80 },
      trend: { oneOf: ["neutral", "increasing", "strongly_increasing"] },
    },
  },
  {
    id: "H",
    name: "Deceased Icon",
    type: "player_opportunity",
    group: "player_opportunity",
    expectations: {
      opportunityScore: { min: 60 },
      qualityScore: { min: 80 },
    },
  },
  {
    id: "I",
    name: "Average Veteran",
    type: "player_opportunity",
    group: "player_opportunity",
    expectations: {
      opportunityScore: { min: 25, max: 65 },
      trend: { oneOf: ["neutral", "declining", "increasing"] },
    },
  },
  {
    id: "J",
    name: "Negative Public Sentiment",
    type: "player_opportunity",
    group: "player_opportunity",
    expectations: {
      demandScore: { max: 45 },
    },
    relative: [
      { field: "opportunityScore", otherScenario: "I", op: "lessThanScenario" },
      { field: "demandScore", otherScenario: "I", op: "lessThanScenario" },
    ],
  },
];
