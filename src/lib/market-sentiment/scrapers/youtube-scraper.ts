import { fetchPublicText } from "@/lib/market-sentiment/fetch-utils";
import type {
  ScraperResult,
  SentimentScrapeContext,
  YouTubeScrapeData,
} from "@/lib/market-sentiment/internal-types";
import { analyzeTextSentiment } from "@/lib/market-sentiment/sentiment-text";

function parseYouTubeSearchHtml(html: string): YouTubeScrapeData["videos"] {
  const videos: YouTubeScrapeData["videos"] = [];
  const titleMatches = html.match(/"title":\{"runs":\[\{"text":"([^"]+)"\}\]/g) ?? [];
  const viewMatches = html.match(/"viewCountText":\{"simpleText":"([^"]+)"\}/g) ?? [];
  const publishedMatches =
    html.match(/"publishedTimeText":\{"simpleText":"([^"]+)"\}/g) ?? [];

  const limit = Math.min(titleMatches.length, 15);
  for (let index = 0; index < limit; index += 1) {
    const title = titleMatches[index]?.match(/"text":"([^"]+)"/)?.[1];
    if (!title) continue;

    const viewsRaw = viewMatches[index]?.match(/"simpleText":"([^"]+)"/)?.[1] ?? "";
    const views = Number(viewsRaw.replace(/[^\d]/g, "")) || null;
    const publishedAt =
      publishedMatches[index]?.match(/"simpleText":"([^"]+)"/)?.[1] ?? null;

    videos.push({
      title: title.replace(/\\u0026/g, "&"),
      publishedAt,
      viewCount: views,
      sentiment: analyzeTextSentiment(title),
    });
  }

  return videos;
}

export async function scrapeYouTubeSource(
  context: SentimentScrapeContext
): Promise<ScraperResult<YouTubeScrapeData>> {
  const collectedAt = new Date().toISOString();
  const query = encodeURIComponent(
    `${context.input.playerName} ${context.input.cardSetName ?? ""} sports cards`.trim()
  );

  try {
    const html = await fetchPublicText(
      `https://www.youtube.com/results?search_query=${query}&sp=CAI%253D`,
      { timeoutMs: 12_000 }
    );
    const videos = parseYouTubeSearchHtml(html);
    const totalViews = videos.reduce((sum, video) => sum + (video.viewCount ?? 0), 0);

    return {
      slug: context.source.slug,
      success: videos.length > 0,
      data: { videos, totalVideos: videos.length, totalViews },
      dataPointCount: videos.length,
      error: videos.length === 0 ? "No YouTube videos found." : undefined,
      collectedAt,
    };
  } catch (error) {
    return {
      slug: context.source.slug,
      success: false,
      data: { videos: [], totalVideos: 0, totalViews: 0 },
      dataPointCount: 0,
      error: error instanceof Error ? error.message : "YouTube scrape failed.",
      collectedAt,
    };
  }
}
