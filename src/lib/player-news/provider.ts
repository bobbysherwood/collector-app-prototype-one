import { analyzeTextSentiment } from "@/lib/market-sentiment/sentiment-text";
import { fetchPublicText } from "@/lib/market-sentiment/fetch-utils";
import { resolveResearchSport } from "@/lib/market-research/catalog";
import { TtlCache, normalizeCacheKey } from "@/lib/player-stats/cache";
import {
  googleNewsSearchUrl,
  mergePlayerNewsItems,
  newsItemId,
  parseNewsRssItems,
} from "@/lib/player-news/parse";
import type {
  PlayerNewsItem,
  PlayerNewsLookupInput,
  PlayerNewsSnapshot,
  TextFetcher,
} from "@/lib/player-news/types";

const NEWS_TTL_MS = 45 * 60 * 1000;
const snapshotCache = new TtlCache<PlayerNewsSnapshot>(NEWS_TTL_MS);

export interface PlayerNewsProviderDeps {
  fetchText?: TextFetcher;
  now?: () => Date;
}

function leagueLabel(sportLabel: string): string {
  return resolveResearchSport(sportLabel)?.name ?? sportLabel;
}

function leagueFeeds(sportLabel: string): Array<{ name: string; url: string }> {
  const slug = resolveResearchSport(sportLabel)?.slug;
  switch (slug) {
    case "nba":
      return [
        { name: "ESPN", url: "https://www.espn.com/espn/rss/nba/news" },
        { name: "NBA.com", url: "https://www.nba.com/news/rss" },
      ];
    case "nfl":
      return [{ name: "ESPN", url: "https://www.espn.com/espn/rss/nfl/news" }];
    case "mlb":
      return [{ name: "ESPN", url: "https://www.espn.com/espn/rss/mlb/news" }];
    case "nhl":
      return [{ name: "ESPN", url: "https://www.espn.com/espn/rss/nhl/news" }];
    default:
      return [];
  }
}

function toNewsItems(
  xml: string,
  fallbackSource: string
): PlayerNewsItem[] {
  return parseNewsRssItems(xml, fallbackSource).map((item, index) => ({
    id: newsItemId(item.title, item.url, index),
    title: item.title,
    url: item.url,
    source: item.source,
    publishedAt: item.publishedAt,
    sentiment: analyzeTextSentiment(item.title),
  }));
}

async function fetchFeedItems(
  url: string,
  fallbackSource: string,
  fetcher: TextFetcher
): Promise<{ items: PlayerNewsItem[]; error?: string }> {
  try {
    const xml = await fetcher(url, { timeoutMs: 10_000 });
    return { items: toNewsItems(xml, fallbackSource) };
  } catch {
    return { items: [], error: `${fallbackSource} did not return a usable feed` };
  }
}

export async function loadPlayerNews(
  input: PlayerNewsLookupInput,
  deps: PlayerNewsProviderDeps = {}
): Promise<PlayerNewsSnapshot> {
  const cacheKey = normalizeCacheKey([
    "player-news",
    input.playerName,
    input.sportLabel,
  ]);
  const cached = snapshotCache.get(cacheKey);
  if (cached) return cached;

  const asOf = input.asOf ? new Date(input.asOf) : deps.now?.() ?? new Date();
  const fetcher = deps.fetchText ?? fetchPublicText;
  const league = leagueLabel(input.sportLabel);
  const notes: string[] = [];

  const google = await fetchFeedItems(
    googleNewsSearchUrl(input.playerName, league),
    "Google News",
    fetcher
  );
  if (google.error) notes.push(google.error);

  const feeds = leagueFeeds(input.sportLabel);
  const leagueResults = await Promise.all(
    feeds.map((feed) => fetchFeedItems(feed.url, feed.name, fetcher))
  );
  for (const result of leagueResults) {
    if (result.error) notes.push(result.error);
  }

  const merged = mergePlayerNewsItems(
    [
      {
        items: google.items,
        sourceNote: "Headlines from Google News RSS",
      },
      ...leagueResults.map((result, index) => ({
        items: result.items,
        sourceNote: `Headlines from ${feeds[index]?.name ?? "league RSS"}`,
      })),
    ],
    input.playerName,
    asOf
  );

  const sourceNotes =
    merged.sourceNotes.length > 0
      ? [...merged.sourceNotes, ...notes]
      : notes.length > 0
        ? notes
        : ["No recent headlines matched this player"];

  const snapshot: PlayerNewsSnapshot = {
    playerName: input.playerName,
    sportLabel: input.sportLabel,
    items: merged.items,
    sourceNotes,
  };

  return snapshotCache.set(cacheKey, snapshot);
}

export function clearPlayerNewsCache(): void {
  snapshotCache.clear();
}
