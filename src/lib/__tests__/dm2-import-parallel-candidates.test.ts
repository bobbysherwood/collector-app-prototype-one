import { describe, expect, it } from "vitest";
import {
  buildExtendedParallelCandidates,
  resolveBestParallelSuffix,
} from "@/lib/dm2-import-parallel-reconcile";

describe("buildExtendedParallelCandidates", () => {
  it("keeps observed compound suffixes without cartesian-producting the catalog", () => {
    const values = [
      "Concourse",
      "Concourse Prizms",
      "Concourse Prizms Gold",
      "Premier Level",
      "Premier Level Prizms",
      "Courtside",
      "Courtside Tie-Dye",
    ];
    const catalog = [
      "Prizms",
      "Gold",
      "Tie-Dye",
      ...Array.from({ length: 400 }, (_, index) => `Parallel ${index}`),
    ];

    const candidates = buildExtendedParallelCandidates(catalog, values);
    const keys = new Set(candidates.map((name) => name.toLowerCase()));

    expect(candidates.length).toBeLessThan(450);
    expect(keys.has("prizms")).toBe(true);
    expect(keys.has("prizms gold")).toBe(true);
    expect(keys.has("gold")).toBe(true);
    expect(keys.has("tie-dye")).toBe(true);
    expect(keys.has("prizms parallel 1")).toBe(false);
  });

  it("picks the longest matching suffix without scanning the candidate list twice", () => {
    expect(
      resolveBestParallelSuffix("Concourse Prizms Gold", [
        "Gold",
        "Prizms Gold",
        "Prizms",
      ])
    ).toBe("Prizms Gold");
  });
});
