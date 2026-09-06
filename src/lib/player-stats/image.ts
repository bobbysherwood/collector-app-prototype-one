import { fetchJson, PLAYER_STATS_USER_AGENT } from "@/lib/player-stats/fetch";
import type { JsonFetcher } from "@/lib/player-stats/types";

export function nbaHeadshotUrl(nbaPersonId: string): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${encodeURIComponent(nbaPersonId)}.png`;
}

export function wikimediaFileUrl(imageValue: string | null | undefined): string | null {
  if (!imageValue) return null;
  const trimmed = imageValue.trim();
  if (!trimmed) return null;

  if (trimmed.includes("Special:FilePath/")) {
    try {
      const url = new URL(trimmed.replace(/^http:/i, "https:"));
      url.searchParams.set("width", "640");
      return url.toString();
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:/i, "https:");
  }

  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(trimmed)}?width=640`;
}

export async function probeImageUrl(
  url: string,
  init?: { timeoutMs?: number }
): Promise<boolean> {
  const timeoutMs = init?.timeoutMs ?? 6_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": PLAYER_STATS_USER_AGENT,
        Accept: "image/*,*/*",
      },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") ?? "";
    return contentType.startsWith("image/") || contentType === "";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

interface WikipediaSummary {
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}

export async function fetchWikipediaPageImage(
  playerName: string,
  fetcher: JsonFetcher = fetchJson
): Promise<string | null> {
  const title = playerName.trim().replace(/\s+/g, "_");
  if (!title) return null;
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const json = (await fetcher(url, {
      headers: { Accept: "application/json" },
    })) as WikipediaSummary;
    return json.originalimage?.source ?? json.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

export async function resolvePlayerImageUrl(input: {
  nbaPersonId?: string | null;
  wikidataImage?: string | null;
  playerName?: string;
  fallbackUrl?: string | null;
  fallbackSource?: string | null;
  probeImage?: (url: string) => Promise<boolean>;
  fetchJson?: JsonFetcher;
}): Promise<{ url: string; source: string } | null> {
  const probe = input.probeImage ?? probeImageUrl;
  const candidates: Array<{ url: string; source: string }> = [];

  if (input.nbaPersonId) {
    candidates.push({
      url: nbaHeadshotUrl(input.nbaPersonId),
      source: "NBA headshot",
    });
  }

  if (input.fallbackUrl) {
    candidates.push({
      url: input.fallbackUrl,
      source: input.fallbackSource ?? "League headshot",
    });
  }

  const wikiImage = wikimediaFileUrl(input.wikidataImage);
  if (wikiImage) {
    candidates.push({ url: wikiImage, source: "Wikimedia Commons" });
  }

  for (const candidate of candidates) {
    if (await probe(candidate.url)) return candidate;
  }

  if (input.playerName) {
    const wikipedia = await fetchWikipediaPageImage(
      input.playerName,
      input.fetchJson
    );
    if (wikipedia && (await probe(wikipedia))) {
      return { url: wikipedia, source: "Wikipedia" };
    }
  }

  return candidates[0] ?? null;
}
