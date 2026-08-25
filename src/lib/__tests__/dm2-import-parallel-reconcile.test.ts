import { describe, expect, it } from "vitest";
import {
  buildExtendedParallelCandidates,
  resolveBestParallelSuffix,
} from "@/lib/dm2-import-parallel-reconcile";
import { enrichCardSetValueSplits } from "@/lib/dm2-import-file-content";

describe("buildExtendedParallelCandidates", () => {
  it("infers Fast Break compound suffixes from sibling CARD SET values", () => {
    const candidates = buildExtendedParallelCandidates(
      [],
      [
        "Elite Dominators",
        "Elite Dominators Fast Break",
        "Elite Dominators Fast Break Pink",
        "Elite Dominators Gold",
      ]
    );

    expect(candidates).toContain("Fast Break Pink");
    expect(candidates).toContain("Fast Break");
    expect(candidates).toContain("Pink");
    expect(candidates).toContain("Gold");
  });

  it("does not cartesian-product suffixes or catalog parallels", () => {
    const inserts = [
      "Genesis",
      "National Pride",
      "Elevate",
      "Introductions",
      "Overdrive",
      "Heat Check",
    ];
    const parallels = [
      "Gold",
      "Silver",
      "Black",
      "Green",
      "Fast Break",
      "Fast Break Pink",
      "Mosaic Gold",
      "Reactive Blue",
    ];
    const values = inserts.flatMap((insert) => [
      insert,
      ...parallels.map((parallel) => `${insert} ${parallel}`),
    ]);
    const catalogParallels = Array.from(
      { length: 250 },
      (_, index) => `Catalog Parallel ${index}`
    );

    const candidates = buildExtendedParallelCandidates(
      catalogParallels,
      values
    );

    expect(candidates.length).toBeLessThan(
      values.length + catalogParallels.length + 50
    );
    expect(candidates).toContain("Fast Break Pink");
    expect(candidates).not.toContain("Gold Silver");
    expect(candidates).not.toContain(
      "Catalog Parallel 0 Catalog Parallel 1"
    );
  });
});

describe("resolveBestParallelSuffix", () => {
  it("prefers the longest word-boundary suffix", () => {
    expect(
      resolveBestParallelSuffix("Elite Dominators Fast Break Pink", [
        "Pink",
        "Fast Break",
        "Fast Break Pink",
      ])
    ).toBe("Fast Break Pink");
  });

  it("keeps the first equal-length match without scanning the list for indexes", () => {
    expect(
      resolveBestParallelSuffix("Rookies Gold Vinyl", ["Gold Vinyl", "Vinyl Gold"])
    ).toBe("Gold Vinyl");
  });
});

describe("enrichCardSetValueSplits", () => {
  it("keeps Fast Break with its color instead of splitting Pink onto the set name", () => {
    const values = [
      "Elite Dominators",
      "Elite Dominators Fast Break",
      "Elite Dominators Fast Break Pink",
    ];
    const enriched = enrichCardSetValueSplits({
      distinctValues: values,
      splits: {},
      catalogParallels: [],
      catalogCardSetNames: [],
      catalogInsertSetNames: [],
    });

    expect(enriched["Elite Dominators Fast Break Pink"]).toMatchObject({
      cardSetName: "Elite Dominators",
      parallel: "Fast Break Pink",
    });
  });
});
