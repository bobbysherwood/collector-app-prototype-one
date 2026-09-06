import type { JsonFetcher } from "@/lib/player-stats/types";

export const PLAYER_STATS_USER_AGENT =
  "CollectorAppResearch/1.0 (market-research player stats; prototype)";

export const NBA_STATS_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

export async function fetchJson(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<unknown> {
  const timeoutMs = init?.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": PLAYER_STATS_USER_AGENT,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function createHeaderFetcher(
  extraHeaders: Record<string, string>
): JsonFetcher {
  return (url, init) =>
    fetchJson(url, {
      ...init,
      headers: {
        ...extraHeaders,
        ...(init?.headers ?? {}),
      },
    });
}
