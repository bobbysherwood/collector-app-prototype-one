import type {
  FieldExpectation,
  RelativeScenarioExpectation,
  ScenarioExpectationMap,
  ValidationCaseResult,
  ValidationStatus,
} from "@/lib/model-validation/types";

function readField(source: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((value, key) => {
    if (value == null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

export function evaluateExpectation(
  actual: unknown,
  expectation: FieldExpectation
): { ok: boolean; message: string } {
  if (expectation.min != null) {
    if (typeof actual !== "number" || actual < expectation.min) {
      return { ok: false, message: `expected >= ${expectation.min}, got ${String(actual)}` };
    }
  }
  if (expectation.max != null) {
    if (typeof actual !== "number" || actual > expectation.max) {
      return { ok: false, message: `expected <= ${expectation.max}, got ${String(actual)}` };
    }
  }
  if (expectation.equals != null && actual !== expectation.equals) {
    return { ok: false, message: `expected ${String(expectation.equals)}, got ${String(actual)}` };
  }
  if (expectation.greaterThan != null) {
    if (typeof actual !== "number" || !(actual > expectation.greaterThan)) {
      return {
        ok: false,
        message: `expected > ${expectation.greaterThan}, got ${String(actual)}`,
      };
    }
  }
  if (expectation.lessThan != null) {
    if (typeof actual !== "number" || !(actual < expectation.lessThan)) {
      return {
        ok: false,
        message: `expected < ${expectation.lessThan}, got ${String(actual)}`,
      };
    }
  }
  if (expectation.oneOf && !expectation.oneOf.includes(actual as never)) {
    return {
      ok: false,
      message: `expected one of ${expectation.oneOf.join(", ")}, got ${String(actual)}`,
    };
  }
  if (expectation.contains) {
    const haystack = Array.isArray(actual)
      ? actual.join(" ")
      : typeof actual === "string"
        ? actual
        : "";
    if (!haystack.toLowerCase().includes(expectation.contains.toLowerCase())) {
      return { ok: false, message: `expected to contain "${expectation.contains}"` };
    }
  }
  if (expectation.notContains) {
    const haystack = Array.isArray(actual)
      ? actual.join(" ")
      : typeof actual === "string"
        ? actual
        : "";
    if (haystack.toLowerCase().includes(expectation.notContains.toLowerCase())) {
      return { ok: false, message: `expected not to contain "${expectation.notContains}"` };
    }
  }
  return { ok: true, message: "ok" };
}

export function evaluateExpectationMap(
  output: Record<string, unknown>,
  expectations: ScenarioExpectationMap,
  meta: Pick<ValidationCaseResult, "id" | "name" | "group">
): ValidationCaseResult[] {
  return Object.entries(expectations).map(([field, expectation]) => {
    if (!expectation) {
      return {
        ...meta,
        id: `${meta.id}:${field}`,
        name: `${meta.name} · ${field}`,
        status: "pass" as ValidationStatus,
        expected: "n/a",
        actual: "n/a",
      };
    }
    const actual = readField(output, field);
    const result = evaluateExpectation(actual, expectation);
    return {
      ...meta,
      id: `${meta.id}:${field}`,
      name: `${meta.name} · ${field}`,
      status: result.ok ? "pass" : "fail",
      expected: JSON.stringify(expectation),
      actual: Array.isArray(actual) ? actual.join(" | ") : String(actual),
      why: result.ok ? undefined : result.message,
    };
  });
}

export function evaluateRelative(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  relative: RelativeScenarioExpectation,
  meta: Pick<ValidationCaseResult, "id" | "name" | "group">
): ValidationCaseResult {
  const leftValue = readField(left, relative.field);
  const rightValue = readField(right, relative.field);
  const minDelta = relative.minDelta ?? 0;
  const ok =
    typeof leftValue === "number" &&
    typeof rightValue === "number" &&
    (relative.op === "greaterThanScenario"
      ? leftValue > rightValue + minDelta
      : leftValue < rightValue - minDelta);

  return {
    ...meta,
    id: `${meta.id}:${relative.field}:${relative.op}`,
    name: `${meta.name} · ${relative.field} ${relative.op} ${relative.otherScenario}`,
    status: ok ? "pass" : "fail",
    expected: `${relative.op} ${relative.otherScenario}${minDelta ? ` by ${minDelta}` : ""}`,
    actual: `${String(leftValue)} vs ${String(rightValue)}`,
    why: ok
      ? undefined
      : `${relative.field} did not satisfy ${relative.op} versus ${relative.otherScenario}`,
  };
}

export function makeCase(
  meta: Pick<ValidationCaseResult, "id" | "name" | "group">,
  ok: boolean,
  expected: string,
  actual: string,
  why?: string,
  status: ValidationStatus = ok ? "pass" : "fail"
): ValidationCaseResult {
  return {
    ...meta,
    status,
    expected,
    actual,
    why: status === "pass" ? undefined : why,
  };
}
