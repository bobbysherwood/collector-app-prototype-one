const DEFAULT_USER_AGENT =
  "CollectorAppSentimentBot/1.0 (+https://localhost; research prototype)";

export async function fetchPublicText(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<string> {
  const timeoutMs = init?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/json, application/rss+xml, text/xml, text/html, */*",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPublicJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const text = await fetchPublicText(url, init);
  return JSON.parse(text) as T;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return null;
  return (Date.now() - parsed) / (1000 * 60 * 60 * 24);
}

export function recencyMultiplier(days: number | null, maxDays = 14): number {
  if (days == null) return 0.5;
  if (days <= 1) return 1;
  if (days <= 3) return 0.9;
  if (days <= 7) return 0.75;
  if (days <= maxDays) return 0.55;
  return 0.25;
}
