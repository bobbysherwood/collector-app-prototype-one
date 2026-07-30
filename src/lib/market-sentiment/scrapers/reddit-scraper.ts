import { fetchPublicJson } from "@/lib/market-sentiment/fetch-utils";
import type {
  RedditScrapeData,
  ScraperResult,
  SentimentScrapeContext,
} from "@/lib/market-sentiment/internal-types";
import { analyzeTextSentiment } from "@/lib/market-sentiment/sentiment-text";

interface RedditListing {
  data?: {
    children?: Array<{
      data?: {
        title?: string;
        subreddit?: string;
        score?: number;
        num_comments?: number;
        created_utc?: number;
      };
    }>;
  };
}

export async function scrapeRedditSource(
  context: SentimentScrapeContext
): Promise<ScraperResult<RedditScrapeData>> {
  const collectedAt = new Date().toISOString();
  const subreddits =
    (context.source.config.subreddits as string[] | undefined) ?? [
      "basketballcards",
      "sportscards",
      "nba",
    ];
  const query = encodeURIComponent(context.input.playerName);
  const posts: RedditScrapeData["posts"] = [];
  const topicCounts = new Map<string, number>();

  for (const subreddit of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${query}&restrict_sr=1&sort=new&limit=15`;
      const payload = await fetchPublicJson<RedditListing>(url, { timeoutMs: 10_000 });
      const children = payload.data?.children ?? [];

      for (const child of children) {
        const data = child.data;
        if (!data?.title) continue;

        const title = data.title;
        const sentiment = analyzeTextSentiment(title);
        posts.push({
          title,
          subreddit: data.subreddit ?? subreddit,
          score: data.score ?? 0,
          numComments: data.num_comments ?? 0,
          sentiment,
          createdUtc: data.created_utc ?? 0,
        });

        for (const token of title.toLowerCase().split(/\W+/).filter((w) => w.length > 4)) {
          topicCounts.set(token, (topicCounts.get(token) ?? 0) + 1);
        }
      }
    } catch {
      // Continue with other subreddits
    }
  }

  const commonTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  const totalComments = posts.reduce((sum, post) => sum + post.numComments, 0);
  const totalUpvotes = posts.reduce((sum, post) => sum + post.score, 0);

  return {
    slug: context.source.slug,
    success: posts.length > 0,
    data: {
      posts,
      totalDiscussions: posts.length,
      totalComments,
      totalUpvotes,
      commonTopics,
    },
    dataPointCount: posts.length,
    error: posts.length === 0 ? "No Reddit discussions found." : undefined,
    collectedAt,
  };
}
