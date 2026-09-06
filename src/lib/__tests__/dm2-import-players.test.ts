import { describe, expect, it } from "vitest";
import {
  buildImportPlayerReview,
  buildPlayerCommitGroups,
  countPendingPlayerReviewPairs,
  mergeImportPlayerReview,
  resolveImportPlayerReviewPair,
  splitImportPlayerParts,
} from "@/lib/dm2-import-players";
import type {
  Dm2ExtractedRow,
  Dm2ImportCatalogContext,
  Dm2ImportSession,
} from "@/types/dm2-import";

function catalog(players: Dm2ImportCatalogContext["players"]): Dm2ImportCatalogContext {
  return {
    entityDescriptions: [],
    sports: [{ id: "sport-nba", label: "NBA Basketball", active: true }],
    manufacturers: [],
    brands: [],
    cardSetCategories: [],
    cardSetNames: [],
    parallels: [],
    cardSets: [],
    cards: [],
    players,
    playerAliases: [],
  };
}

function row(
  overrides: Partial<Dm2ExtractedRow> & Pick<Dm2ExtractedRow, "id" | "player">
): Dm2ExtractedRow {
  return {
    sourceFileName: "list.xlsx",
    sourceRowIndex: 1,
    sport: "NBA Basketball",
    year: 2024,
    manufacturer: "Panini",
    brand: "Prizm",
    cardSetCategory: "Base Set",
    cardSetName: "Base Set",
    cardNumber: "1",
    confidence: 1,
    excluded: false,
    ...overrides,
  };
}

function session(rows: Dm2ExtractedRow[], players: Dm2ImportCatalogContext["players"] = []): Dm2ImportSession {
  return {
    id: "session-1",
    files: [{ fileName: "list.xlsx", status: "success", rowCount: rows.length }],
    sessionContext: { sport: "NBA Basketball" },
    rows,
    proposals: [
      {
        id: "sport-proposal",
        entityType: "sport",
        proposedName: "NBA Basketball",
        normalizedKey: "nba basketball",
        matchId: "sport-nba",
        matchName: "NBA Basketball",
        confidence: 1,
        action: "use_existing",
        referenceCount: rows.length,
        sourceFiles: ["list.xlsx"],
      },
    ],
    issues: [],
    suggestions: [],
    researchNotes: [],
    mappingFramework: [],
    model: "test",
    promptVersion: "test",
    catalog: catalog(players),
  };
}

describe("splitImportPlayerParts", () => {
  it("splits combo cards on slash", () => {
    expect(splitImportPlayerParts("Ken Griffey / Frank Thomas")).toEqual([
      "Ken Griffey",
      "Frank Thomas",
    ]);
  });
});

describe("buildImportPlayerReview", () => {
  it("exact-matches catalog players and skips review", () => {
    const review = buildImportPlayerReview(
      session(
        [row({ id: "r1", player: "Michael Jordan" })],
        [
          {
            id: "p-mj",
            sportId: "sport-nba",
            name: "Michael Jordan",
            nameKey: "michael jordan",
            active: true,
          },
        ]
      )
    );

    expect(review.names).toHaveLength(1);
    expect(review.names[0]?.exactMatchId).toBe("p-mj");
    expect(review.pairs).toHaveLength(0);
  });

  it("auto-creates names below 90% similarity", () => {
    const review = buildImportPlayerReview(
      session(
        [row({ id: "r1", player: "Giannis Antetokounmpo" })],
        [
          {
            id: "p-mj",
            sportId: "sport-nba",
            name: "Michael Jordan",
            nameKey: "michael jordan",
            active: true,
          },
        ]
      )
    );

    expect(review.names[0]?.exactMatchId).toBeUndefined();
    expect(review.pairs).toHaveLength(0);
  });

  it("flags 90-99% catalog matches for review", () => {
    const review = buildImportPlayerReview(
      session(
        [row({ id: "r1", player: "Stephan Curry" })],
        [
          {
            id: "p-sc",
            sportId: "sport-nba",
            name: "Stephen Curry",
            nameKey: "stephen curry",
            active: true,
          },
        ]
      )
    );

    expect(review.pairs).toHaveLength(1);
    expect(review.pairs[0]?.similarity).toBeGreaterThanOrEqual(0.9);
    expect(review.pairs[0]?.similarity).toBeLessThan(1);
    expect(
      [review.pairs[0]?.left.name, review.pairs[0]?.right.name].sort()
    ).toEqual(["Stephan Curry", "Stephen Curry"]);
  });

  it("flags similar unmatched import names against each other", () => {
    const review = buildImportPlayerReview(
      session([
        row({ id: "r1", player: "Stephen Curry" }),
        row({ id: "r2", cardNumber: "2", player: "Stephan Curry" }),
      ])
    );

    expect(review.pairs.length).toBeGreaterThan(0);
    expect(countPendingPlayerReviewPairs(review)).toBe(review.pairs.length);
  });

  it("splits combo cards into two player names", () => {
    const review = buildImportPlayerReview(
      session([row({ id: "r1", player: "Michael Jordan / Scottie Pippen" })])
    );

    expect(review.names.map((name) => name.name).sort()).toEqual([
      "Michael Jordan",
      "Scottie Pippen",
    ]);
  });
});

describe("player review resolutions", () => {
  it("merges a file spelling into the catalog player", () => {
    const started = session(
      [row({ id: "r1", player: "Stephan Curry" })],
      [
        {
          id: "p-sc",
          sportId: "sport-nba",
          name: "Stephen Curry",
          nameKey: "stephen curry",
          active: true,
        },
      ]
    );
    const withReview = {
      ...started,
      playerReview: buildImportPlayerReview(started),
    };
    const pair = withReview.playerReview!.pairs[0]!;
    const canonicalSide =
      pair.left.catalogPlayerId != null ? "left" : "right";
    const resolved = resolveImportPlayerReviewPair(withReview, pair.id, {
      action: "merge",
      canonicalSide,
    });
    const plan = buildPlayerCommitGroups(mergeImportPlayerReview(resolved));

    expect(plan.error).toBeUndefined();
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]?.catalogPlayerId).toBe("p-sc");
    expect(plan.groups[0]?.aliasNames).toContain("Stephan Curry");
  });

  it("keeps both as separate create groups", () => {
    const started = session([
      row({ id: "r1", player: "Stephen Curry" }),
      row({ id: "r2", cardNumber: "2", player: "Stephan Curry" }),
    ]);
    const withReview: Dm2ImportSession = {
      ...started,
      playerReview: buildImportPlayerReview(started),
    };
    let current: Dm2ImportSession = withReview;
    for (const pair of withReview.playerReview!.pairs) {
      current = resolveImportPlayerReviewPair(current, pair.id, {
        action: "keep_both",
      });
    }
    const plan = buildPlayerCommitGroups(mergeImportPlayerReview(current));

    expect(plan.error).toBeUndefined();
    expect(plan.groups.length).toBeGreaterThanOrEqual(2);
    expect(plan.groups.every((group) => !group.catalogPlayerId)).toBe(true);
  });
});
