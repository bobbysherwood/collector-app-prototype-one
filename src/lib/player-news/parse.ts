import { playerMentioned } from "@/lib/market-sentiment/sentiment-text";
import type { PlayerNewsItem } from "@/lib/player-news/types";

const NEWS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const PLAYER_NEWS_LIMIT = 20;

export function googleNewsSearchUrl(playerName: string, league: string): string {
  const query = `"${playerName.trim()}" ${league.trim()}`.trim();
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url.toString();
}

export function decodeRssText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function parseNewsRssItems(
  xml: string,
  fallbackSource: string
): Array<{
  title: string;
  url: string | null;
  publishedAt: string | null;
  source: string;
}> {
  const items: Array<{
    title: string;
    url: string | null;
    publishedAt: string | null;
    source: string;
  }> = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of blocks) {
    const rawTitle = block.match(/<title(?:[^>]*)>([\s\S]*?)<\/title>/i)?.[1];
    const title = rawTitle ? decodeRssText(rawTitle) : "";
    if (!title) continue;

    const rawLink = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? null;
    const rawDate =
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ??
      block.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] ??
      null;
    const rawSource = block.match(/<source(?:[^>]*)>([\s\S]*?)<\/source>/i)?.[1];
    const sourceFromTag = rawSource ? decodeRssText(rawSource) : "";
    const sourceFromTitle = title.match(/\s[-–|]\s+(.+)$/)?.[1]?.trim() ?? "";

    items.push({
      title,
      url: rawLink ? decodeRssText(rawLink) : null,
      publishedAt: toIsoDate(rawDate ? decodeRssText(rawDate) : null),
      source: sourceFromTag || sourceFromTitle || fallbackSource,
    });
  }

  return items;
}

export function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function isWithinNewsWindow(
  publishedAt: string | null,
  asOf = new Date()
): boolean {
  if (!publishedAt) return true;
  const parsed = Date.parse(publishedAt);
  if (Number.isNaN(parsed)) return true;
  return asOf.getTime() - parsed <= NEWS_WINDOW_MS;
}

export function normalizeHeadline(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+[-–|]\s+[^-–|]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function mergePlayerNewsItems(
  groups: Array<{ items: PlayerNewsItem[]; sourceNote: string }>,
  playerName: string,
  asOf = new Date()
): { items: PlayerNewsItem[]; sourceNotes: string[] } {
  const seen = new Set<string>();
  const merged: PlayerNewsItem[] = [];
  const sourceNotes: string[] = [];

  for (const group of groups) {
    let kept = 0;
    for (const item of group.items) {
      if (!playerMentioned(item.title, playerName)) continue;
      if (!isWithinNewsWindow(item.publishedAt, asOf)) continue;
      const key = normalizeHeadline(item.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      kept += 1;
    }
    if (kept > 0) sourceNotes.push(group.sourceNote);
  }

  merged.sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bTime - aTime;
  });

  return {
    items: merged.slice(0, PLAYER_NEWS_LIMIT),
    sourceNotes,
  };
}

export function newsItemId(title: string, url: string | null, index: number): string {
  const key = `${normalizeHeadline(title)}|${url ?? ""}|${index}`;
  return key.slice(0, 180);
}
