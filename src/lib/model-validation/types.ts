import type {
  PlayerCardOpportunity,
  PlayerOpportunity,
} from "@/types/player-opportunity";

export type ValidationStatus = "pass" | "fail" | "warning";

export type ValidationSuiteGroup =
  | "player_opportunity"
  | "card_opportunity"
  | "sensitivity"
  | "risk"
  | "seasonality"
  | "sport_market"
  | "data_quality"
  | "explainability"
  | "ranking"
  | "backtest"
  | "regression"
  | "invariants";

export type ExpectationOp =
  | "min"
  | "max"
  | "equals"
  | "greaterThan"
  | "lessThan"
  | "oneOf"
  | "contains"
  | "notContains";

export interface FieldExpectation {
  min?: number;
  max?: number;
  equals?: string | number | boolean;
  greaterThan?: number;
  lessThan?: number;
  oneOf?: Array<string | number>;
  contains?: string;
  notContains?: string;
}

export interface ScenarioExpectationMap {
  [field: string]: FieldExpectation | undefined;
}

export interface RelativeScenarioExpectation {
  field: string;
  otherScenario: string;
  op: "greaterThanScenario" | "lessThanScenario";
  minDelta?: number;
}

export interface ModelValidationScenario {
  id: string;
  name: string;
  type: "player_opportunity" | "player_card_opportunity";
  group: ValidationSuiteGroup;
  notes?: string[];
  expectations: ScenarioExpectationMap;
  relative?: RelativeScenarioExpectation[];
}

export interface ValidationCaseResult {
  id: string;
  name: string;
  group: ValidationSuiteGroup;
  status: ValidationStatus;
  expected: string;
  actual: string;
  difference?: string;
  why?: string;
  notes?: string[];
}

export interface ValidationGroupSummary {
  group: ValidationSuiteGroup;
  tests: number;
  passed: number;
  failed: number;
  warnings: number;
  passRate: number;
}

export interface ValidationReport {
  generatedAt: string;
  groups: ValidationGroupSummary[];
  cases: ValidationCaseResult[];
  backtest?: BacktestSummary;
  overallStatus: "PASS" | "PASS WITH WARNINGS" | "FAIL";
}

export interface BacktestSummary {
  observations: number;
  correlation90d: number | null;
  directionalAccuracy: number | null;
  topDecileReturn: number | null;
  bottomDecileReturn: number | null;
  lookAheadViolations: number;
}

export interface PlayerOpportunityDiagnostics {
  result: PlayerOpportunity;
  components: {
    quality: number;
    futureOutlook: number;
    demand: number;
    sportMarket: number;
    momentum: number;
    catalysts: number;
  };
  weightedContributions: Record<string, number>;
}

export interface PlayerCardOpportunityDiagnostics {
  result: PlayerCardOpportunity;
  components: {
    playerOpportunity: number;
    valuation: number;
    scarcity: number;
    demandMomentum: number;
    expectedReturn: number;
    riskAdjustedReturn: number;
    liquidity: number;
  };
  weightedContributions: Record<string, number>;
}
