import { describe, expect, it } from "vitest";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import { buildPlayerOpportunityContextFromIdentity } from "@/lib/player-opportunity/build-player-context";
import {
  applyNewsInjuryToQuality,
  catalystsFromNews,
  demandSignalsFromNews,
} from "@/lib/player-news/demand";
import type { PlayerNewsItem, PlayerNewsSnapshot } from "@/lib/player-news/types";

const AS_OF = new Date("2026-09-05T18:00:00.000Z");

function item(overrides: Partial<PlayerNewsItem> = {}): PlayerNewsItem {
  return {
    id: overrides.id ?? "1",
    title: overrides.title ?? "Jayson Tatum scores 30",
    url: overrides.url ?? "https://example.com/1",
    source: overrides.source ?? "ESPN",
    publishedAt: overrides.publishedAt ?? "2026-09-05T12:00:00.000Z",
    sentiment: overrides.sentiment ?? "neutral",
  };
}

function news(items: PlayerNewsItem[]): PlayerNewsSnapshot {
  return {
    playerName: "Jayson Tatum",
    sportLabel: "Basketball",
    items,
    sourceNotes: [],
  };
}

describe("player news demand", () => {
  it("returns empty demand when there are no recent headlines", () => {
    expect(demandSignalsFromNews(news([]), AS_OF).sourceCount).toBe(0);
    expect(catalystsFromNews(news([]), AS_OF)).toEqual([]);
  });

  it("scores attention, sentiment, and source count from headlines", () => {
    const signals = demandSignalsFromNews(
      news([
        item({
          id: "a",
          title: "Jayson Tatum named MVP after stellar win",
          source: "ESPN",
          sentiment: "positive",
          publishedAt: "2026-09-05T12:00:00.000Z",
        }),
        item({
          id: "b",
          title: "Tatum extension talks heat up",
          source: "The Athletic",
          sentiment: "positive",
          publishedAt: "2026-09-04T12:00:00.000Z",
        }),
        item({
          id: "c",
          title: "Celtics preview",
          source: "ESPN",
          sentiment: "neutral",
          publishedAt: "2026-09-03T12:00:00.000Z",
        }),
      ]),
      AS_OF
    );

    expect(signals.sourceCount).toBe(2);
    expect(signals.attentionScore).toBeGreaterThanOrEqual(50);
    expect(signals.sentimentScore).toBeGreaterThan(50);
    expect(signals.searchInterestScore).toBeNull();
    expect(signals.discussionGrowthScore).not.toBeNull();
  });

  it("extracts injury, award, and trade catalysts and caps at three", () => {
    const catalysts = catalystsFromNews(
      news([
        item({ title: "Tatum exits with a knee injury", sentiment: "negative" }),
        item({ title: "Tatum named All-Star starter", sentiment: "positive" }),
        item({ title: "Trade rumors swirl around Tatum", sentiment: "neutral" }),
        item({ title: "Tatum signs extension", sentiment: "positive" }),
      ]),
      AS_OF
    );

    expect(catalysts.map((catalyst) => catalyst.id)).toEqual([
      "news-injury",
      "news-trade",
      "news-award",
    ]);
    expect(catalysts[0]?.direction).toBe("negative");
    expect(catalysts[1]?.direction).toBe("neutral");
    expect(catalysts[2]?.direction).toBe("positive");
  });

  it("raises injury risk when injury headlines exist", () => {
    const quality = applyNewsInjuryToQuality(
      {
        careerStrength: 80,
        availableFieldCount: 1,
      },
      catalystsFromNews(
        news([item({ title: "Tatum sidelined with an injury", sentiment: "negative" })]),
        AS_OF
      )
    );
    expect(quality?.injuryRisk).toBeGreaterThanOrEqual(65);
  });

  it("moves player demand off the empty-news baseline", () => {
    const empty = computePlayerOpportunity(
      buildPlayerOpportunityContextFromIdentity({
        playerName: "Jayson Tatum",
        sport: "Basketball",
      })
    );
    const withNews = computePlayerOpportunity(
      buildPlayerOpportunityContextFromIdentity({
        playerName: "Jayson Tatum",
        sport: "Basketball",
        demandSignals: demandSignalsFromNews(
          news([
            item({
              title: "Jayson Tatum named MVP after stellar win",
              sentiment: "positive",
            }),
            item({
              id: "2",
              title: "Tatum extension talks continue",
              source: "Yahoo",
              sentiment: "positive",
              publishedAt: "2026-09-04T08:00:00.000Z",
            }),
          ]),
          AS_OF
        ),
        catalysts: catalystsFromNews(
          news([item({ title: "Tatum named MVP after stellar win" })]),
          AS_OF
        ),
      })
    );

    expect(empty.demandScore).toBe(50);
    expect(withNews.demandScore).toBeGreaterThan(empty.demandScore);
    expect(withNews.catalysts.some((catalyst) => catalyst.id === "news-award")).toBe(
      true
    );
  });
});
