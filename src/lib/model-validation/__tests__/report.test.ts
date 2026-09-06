import { describe, expect, it } from "vitest";
import { formatValidationReport } from "@/lib/model-validation/report";
import { runValidationSuite } from "@/lib/model-validation/run-suite";

describe("Validation report", () => {
  it("renders grouped PASS/FAIL output for the scenario suite", () => {
    const report = runValidationSuite();
    const text = formatValidationReport(report);
    expect(text).toContain("MODEL VALIDATION REPORT");
    expect(text).toContain("PLAYER OPPORTUNITY");
    expect(text).toContain("CARD OPPORTUNITY");
    expect(text).toContain("Overall Status");
    expect(report.groups.length).toBeGreaterThan(0);
  });
});
