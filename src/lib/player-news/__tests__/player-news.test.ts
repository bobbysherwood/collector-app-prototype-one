import { describe, expect, it } from "vitest";
import {
  googleNewsSearchUrl,
  isWithinNewsWindow,
  mergePlayerNewsItems,
  normalizeHeadline,
  parseNewsRssItems,
} from "@/lib/player-news/parse";
import {
  clearPlayerNewsCache,
  loadPlayerNews,
} from "@/lib/player-news/provider";
import type { PlayerNewsItem } from "@/lib/player-news/types";

const GOOGLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
  <item>
    <title><![CDATA[Jayson Tatum named MVP after stellar Celtics win - ESPN]]></title>
    <link>https://news.google.com/rss/articles/tatum-42</link>
    <pubDate>Sat, 05 Sep 2026 12:00:00 GMT</pubDate>
    <source url="https://www.espn.com">ESPN</source>
  </item>
  <item>
    <title>Unrelated baseball notes - MLB.com</title>
    <link>https://news.google.com/rss/articles/baseball</link>
    <pubDate>Sat, 05 Sep 2026 11:00:00 GMT</pubDate>
    <source url="https://www.mlb.com">MLB.com</source>
  </item>
</channel></rss>`;

const ESPN_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
  <item>
    <title>Jayson Tatum named MVP after stellar Celtics win</title>
    <link>https://www.espn.com/nba/story/_/id/tatum-42</link>
    <pubDate>Sat, 05 Sep 2026 12:05:00 GMT</pubDate>
  </item>
  <item>
    <title>Jaylen Brown named Eastern Conference player of the week</title>
    <link>https://www.espn.com/nba/story/_/id/brown</link>
    <pubDate>Sat, 05 Sep 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Old Jayson Tatum feature from last season</title>
    <link>https://www.espn.com/nba/story/_/id/old</link>
    <pubDate>Mon, 01 Aug 2026 10:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

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

describe("player news parsing", () => {
  it("builds a Google News search URL for the player and league", () => {
    expect(googleNewsSearchUrl("Jayson Tatum", "NBA")).toContain(
      "news.google.com/rss/search"
    );
    expect(
      decodeURIComponent(googleNewsSearchUrl("Jayson Tatum", "NBA")).replace(
        /\+/g,
        " "
      )
    ).toContain('"Jayson Tatum" NBA');
  });

  it("reads Google News source tags and CDATA titles", () => {
    const items = parseNewsRssItems(GOOGLE_FEED, "Google News");
    expect(items[0]).toMatchObject({
      title: "Jayson Tatum named MVP after stellar Celtics win - ESPN",
      source: "ESPN",
      url: "https://news.google.com/rss/articles/tatum-42",
    });
    expect(items[0]?.publishedAt).toBe("2026-09-05T12:00:00.000Z");
  });

  it("treats matching name tokens as a player mention and drops others", () => {
    const merged = mergePlayerNewsItems(
      [
        {
          items: parseNewsRssItems(GOOGLE_FEED, "Google News").map((row, index) =>
            item({
              id: String(index),
              title: row.title,
              url: row.url,
              source: row.source,
              publishedAt: row.publishedAt,
            })
          ),
          sourceNote: "Google News",
        },
      ],
      "Jayson Tatum",
      new Date("2026-09-05T18:00:00.000Z")
    );
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0]?.title).toContain("Jayson Tatum");
  });

  it("deduplicates near-identical headlines and drops stale items", () => {
    const merged = mergePlayerNewsItems(
      [
        {
          items: [
            item({
              title: "Jayson Tatum named MVP after stellar Celtics win - ESPN",
              source: "Google News",
            }),
            item({
              title: "Jayson Tatum named MVP after stellar Celtics win",
              source: "ESPN",
              url: "https://www.espn.com/nba/story/_/id/tatum-42",
            }),
            item({
              title: "Old Jayson Tatum feature from last season",
              publishedAt: "2026-08-01T10:00:00.000Z",
            }),
          ],
          sourceNote: "mixed",
        },
      ],
      "Jayson Tatum",
      new Date("2026-09-05T18:00:00.000Z")
    );
    expect(merged.items).toHaveLength(1);
    expect(
      normalizeHeadline("Jayson Tatum named MVP after stellar Celtics win - ESPN")
    ).toBe(
      normalizeHeadline("Jayson Tatum named MVP after stellar Celtics win")
    );
  });

  it("keeps items inside the 14-day window", () => {
    expect(
      isWithinNewsWindow("2026-09-01T00:00:00.000Z", new Date("2026-09-05T00:00:00.000Z"))
    ).toBe(true);
    expect(
      isWithinNewsWindow("2026-08-01T00:00:00.000Z", new Date("2026-09-05T00:00:00.000Z"))
    ).toBe(false);
  });
});

describe("player news provider", () => {
  it("merges Google News and league RSS, keeping only this player", async () => {
    clearPlayerNewsCache();
    const snapshot = await loadPlayerNews(
      {
        playerName: "Jayson Tatum",
        sportLabel: "Basketball",
        asOf: "2026-09-05T18:00:00.000Z",
      },
      {
        fetchText: async (url) => {
          if (url.includes("news.google.com")) return GOOGLE_FEED;
          if (url.includes("espn.com")) return ESPN_FEED;
          if (url.includes("nba.com")) return ESPN_FEED;
          throw new Error(`unexpected feed ${url}`);
        },
      }
    );

    expect(snapshot.items.some((row) => row.title.includes("Jayson Tatum"))).toBe(
      true
    );
    expect(snapshot.items.some((row) => row.title.includes("Jaylen Brown"))).toBe(
      false
    );
    expect(snapshot.items.some((row) => /last season/i.test(row.title))).toBe(false);
    expect(snapshot.items[0]?.sentiment).toBe("positive");
    expect(snapshot.sourceNotes.join(" ")).toMatch(/Google News|ESPN|NBA/);
  });

  it("returns notes when feeds fail and does not throw", async () => {
    clearPlayerNewsCache();
    const snapshot = await loadPlayerNews(
      { playerName: "Jayson Tatum", sportLabel: "Basketball" },
      {
        fetchText: async () => {
          throw new Error("blocked");
        },
      }
    );
    expect(snapshot.items).toEqual([]);
    expect(snapshot.sourceNotes.length).toBeGreaterThan(0);
  });
});
