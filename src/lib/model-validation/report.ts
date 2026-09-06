import type {
  BacktestSummary,
  ValidationCaseResult,
  ValidationGroupSummary,
  ValidationReport,
  ValidationSuiteGroup,
} from "@/lib/model-validation/types";

const GROUP_ORDER: ValidationSuiteGroup[] = [
  "player_opportunity",
  "card_opportunity",
  "sensitivity",
  "risk",
  "seasonality",
  "sport_market",
  "data_quality",
  "explainability",
  "ranking",
  "backtest",
  "regression",
  "invariants",
];

const GROUP_LABEL: Record<ValidationSuiteGroup, string> = {
  player_opportunity: "PLAYER OPPORTUNITY",
  card_opportunity: "CARD OPPORTUNITY",
  sensitivity: "SENSITIVITY",
  risk: "RISK",
  seasonality: "SEASONALITY",
  sport_market: "SPORT MARKET",
  data_quality: "DATA QUALITY",
  explainability: "EXPLAINABILITY",
  ranking: "RANKING",
  backtest: "BACKTEST",
  regression: "REGRESSION",
  invariants: "INVARIANTS",
};

export function summarizeCases(cases: ValidationCaseResult[]): ValidationGroupSummary[] {
  return GROUP_ORDER.map((group) => {
    const rows = cases.filter((item) => item.group === group);
    const passed = rows.filter((item) => item.status === "pass").length;
    const failed = rows.filter((item) => item.status === "fail").length;
    const warnings = rows.filter((item) => item.status === "warning").length;
    return {
      group,
      tests: rows.length,
      passed,
      failed,
      warnings,
      passRate: rows.length === 0 ? 0 : Math.round((passed / rows.length) * 1000) / 10,
    };
  }).filter((row) => row.tests > 0);
}

export function buildValidationReport(
  cases: ValidationCaseResult[],
  backtest?: BacktestSummary
): ValidationReport {
  const groups = summarizeCases(cases);
  const failed = cases.some((item) => item.status === "fail");
  const warnings = cases.some((item) => item.status === "warning");
  return {
    generatedAt: new Date().toISOString(),
    groups,
    cases,
    backtest,
    overallStatus: failed ? "FAIL" : warnings ? "PASS WITH WARNINGS" : "PASS",
  };
}

export function formatValidationReport(report: ValidationReport): string {
  const lines = [
    "MODEL VALIDATION REPORT",
    "=======================",
    "",
  ];

  for (const group of report.groups) {
    lines.push(GROUP_LABEL[group.group]);
    lines.push("-".repeat(GROUP_LABEL[group.group].length));
    lines.push(`Tests:              ${group.tests}`);
    lines.push(`Passed:             ${group.passed}`);
    lines.push(`Failed:             ${group.failed}`);
    if (group.warnings) lines.push(`Warnings:           ${group.warnings}`);
    lines.push(`Pass Rate:          ${group.passRate}%`);
    lines.push("");
  }

  if (report.backtest) {
    lines.push("Backtesting");
    lines.push("-----------");
    lines.push(`Observations:       ${report.backtest.observations.toLocaleString()}`);
    lines.push(`90D Correlation:    ${fmt(report.backtest.correlation90d)}`);
    lines.push(
      `Directional Accuracy: ${fmtPct(report.backtest.directionalAccuracy)}`
    );
    lines.push(`Top Decile Return:  ${fmtPct(report.backtest.topDecileReturn)}`);
    lines.push(`Bottom Decile Return: ${fmtPct(report.backtest.bottomDecileReturn)}`);
    lines.push(`Look-ahead violations: ${report.backtest.lookAheadViolations}`);
    lines.push("");
  }

  lines.push("Overall Status");
  lines.push("--------------");
  lines.push(report.overallStatus);
  lines.push("");

  const failures = report.cases.filter((item) => item.status === "fail");
  if (failures.length > 0) {
    lines.push("Failures");
    lines.push("--------");
    for (const failure of failures) {
      lines.push(`Test Name: ${failure.name}`);
      lines.push(`Expected:  ${failure.expected}`);
      lines.push(`Actual:    ${failure.actual}`);
      if (failure.difference) lines.push(`Difference: ${failure.difference}`);
      if (failure.why) lines.push(`Why:       ${failure.why}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function fmt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  return value.toFixed(2);
}

function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}
