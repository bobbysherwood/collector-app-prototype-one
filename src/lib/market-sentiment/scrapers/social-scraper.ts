import { fetchPublicText } from "@/lib/market-sentiment/fetch-utils";
import type {
  ScraperResult,
  SentimentScrapeContext,
  SocialScrapeData,
} from "@/lib/market-sentiment/internal-types";
import { analyzeTextSentiment } from "@/lib/market-sentiment/sentiment-text";

function extractHashtags(text: string): string[] {
  return [...text.matchAll(/#[A-Za-z0-9_]+/g)].map((match) => match[0].toLowerCase());
}

export async function scrapeSocialSource(
  context: SentimentScrapeContext
): Promise<ScraperResult<SocialScrapeData>> {
  const collectedAt = new Date().toISOString();
  const suffix =
    (context.source.config.querySuffix as string | undefined) ?? "sports cards";
  const query = encodeURIComponent(`${context.input.playerName} ${suffix}`.trim());
  const posts: SocialScrapeData["posts"] = [];
  const hashtagCounts = new Map<string, number>();

  try {
    const html = await fetchPublicText(
      `https://html.duckduckgo.com/html/?q=${query}+site:x.com+OR+site:twitter.com`,
      { timeoutMs: 12_000 }
    );

    const snippets =
      html.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi) ?? [];

    for (const snippetBlock of snippets.slice(0, 20)) {
      const text = snippetBlock
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length < 20) continue;

      const sentiment = analyzeTextSentiment(text);
      posts.push({
        text,
        engagementEstimate: Math.min(100, Math.round(text.length / 4)),
        sentiment,
      });

      for (const tag of extractHashtags(text)) {
        hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + 1);
      }
    }
  } catch (error) {
    return {
      slug: context.source.slug,
      success: false,
      data: { posts: [], mentionCount: 0, totalEngagement: 0, trendingHashtags: [] },
      dataPointCount: 0,
      error: error instanceof Error ? error.message : "Social scrape failed.",
      collectedAt,
    };
  }

  const trendingHashtags = [...hashtagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const totalEngagement = posts.reduce(
    (sum, post) => sum + post.engagementEstimate,
    0
  );

  return {
    slug: context.source.slug,
    success: posts.length > 0,
    data: {
      posts,
      mentionCount: posts.length,
      totalEngagement,
      trendingHashtags,
    },
    dataPointCount: posts.length,
    error: posts.length === 0 ? "No public social mentions found." : undefined,
    collectedAt,
  };
}
