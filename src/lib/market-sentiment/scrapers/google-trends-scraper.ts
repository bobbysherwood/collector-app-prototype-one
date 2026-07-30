import { fetchPublicText } from "@/lib/market-sentiment/fetch-utils";
import type {
  ScraperResult,
  SearchInterestScrapeData,
  SentimentScrapeContext,
} from "@/lib/market-sentiment/internal-types";

function parseTrendsPayload(raw: string): SearchInterestScrapeData | null {
  const cleaned = raw.replace(/^\)\]\}',?\s*/, "");
  try {
    const payload = JSON.parse(cleaned) as {
      default?: {
        timelineData?: Array<{ value?: number[] }>;
        relatedQueries?: {
          rankedList?: Array<{ rankedKeyword?: { query?: string } }>;
        };
      };
    };

    const values =
      payload.default?.timelineData?.flatMap((point) => point.value ?? []) ?? [];
    if (values.length === 0) return null;

    const recent = values.slice(-4);
    const prior = values.slice(-8, -4);
    const recentAvg =
      recent.reduce((sum, value) => sum + value, 0) / Math.max(recent.length, 1);
    const priorAvg =
      prior.length > 0
        ? prior.reduce((sum, value) => sum + value, 0) / prior.length
        : recentAvg;
    const growthPercent =
      priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : null;

    let direction: SearchInterestScrapeData["direction"] = "flat";
    if (growthPercent != null) {
      if (growthPercent > 8) direction = "up";
      else if (growthPercent < -8) direction = "down";
    }

    const relatedQueries =
      payload.default?.relatedQueries?.rankedList
        ?.map((item) => item.rankedKeyword?.query)
        .filter((query): query is string => Boolean(query))
        .slice(0, 5) ?? [];

    return {
      trendScore: clampTrendScore(recentAvg),
      direction,
      growthPercent,
      relatedQueries,
    };
  } catch {
    return null;
  }
}

function clampTrendScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function scrapeSearchInterestSource(
  context: SentimentScrapeContext
): Promise<ScraperResult<SearchInterestScrapeData>> {
  const collectedAt = new Date().toISOString();
  const geo = (context.source.config.geo as string | undefined) ?? "US";
  const query = encodeURIComponent(context.input.playerName);

  try {
    const html = await fetchPublicText(
      `https://trends.google.com/trends/explore?q=${query}&geo=${geo}`,
      { timeoutMs: 12_000 }
    );

    const widgetMatch = html.match(
      /TIMESERIES[\s\S]*?"request":(\{[\s\S]*?\})\s*,\s*"token"/
    );

    if (!widgetMatch?.[1]) {
      throw new Error("Trends widget unavailable.");
    }

    const request = JSON.parse(widgetMatch[1]) as {
      restriction?: { time?: string };
      keyword?: string;
    };
    const tokenMatch = html.match(/"token":"([^"]+)"/);
    if (!tokenMatch?.[1]) {
      throw new Error("Trends token unavailable.");
    }

    const widgetUrl = `https://trends.google.com/trends/api/widgetdata/multiline?req=${encodeURIComponent(
      JSON.stringify({
        time: request.restriction?.time ?? "today 3-m",
        resolution: "WEEK",
        locale: "en-US",
        comparisonItem: [{ keyword: context.input.playerName, geo, time: "today 3-m" }],
        requestOptions: { property: "", backend: "IZG", category: 0 },
      })
    )}&token=${tokenMatch[1]}&tz=300`;

    const payload = await fetchPublicText(widgetUrl, { timeoutMs: 12_000 });
    const parsed = parseTrendsPayload(payload);

    if (!parsed) {
      throw new Error("Unable to parse trends data.");
    }

    return {
      slug: context.source.slug,
      success: true,
      data: parsed,
      dataPointCount: 1,
      collectedAt,
    };
  } catch (error) {
    return {
      slug: context.source.slug,
      success: false,
      data: {
        trendScore: 50,
        direction: "flat",
        growthPercent: null,
        relatedQueries: [],
      },
      dataPointCount: 0,
      error: error instanceof Error ? error.message : "Search interest scrape failed.",
      collectedAt,
    };
  }
}
