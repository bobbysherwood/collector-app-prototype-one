import { clampScore } from "@/lib/market-sentiment/fetch-utils";
import type {
  RedditScrapeData,
  ScraperResult,
  SourceCalculatorResult,
} from "@/lib/market-sentiment/internal-types";

export function calculateRedditScore(
  result: ScraperResult<RedditScrapeData>
): SourceCalculatorResult {
  const { posts, totalComments, totalUpvotes, commonTopics } = result.data;
  if (posts.length === 0) {
    return {
      score: 50,
      positiveDrivers: [],
      negativeDrivers: ["No Reddit discussion volume detected."],
      dataPointCount: 0,
    };
  }

  const positivePosts = posts.filter((post) => post.sentiment === "positive").length;
  const negativePosts = posts.filter((post) => post.sentiment === "negative").length;
  const sentimentRatio = (positivePosts - negativePosts) / posts.length;

  const volumeScore = Math.min(35, posts.length * 3 + totalComments / 10);
  const upvoteScore = Math.min(25, totalUpvotes / 20);
  const score = clampScore(50 + sentimentRatio * 25 + volumeScore * 0.4 + upvoteScore * 0.4);

  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  if (posts.length >= 5) {
    positiveDrivers.push("Reddit discussion volume increased versus baseline.");
  }
  if (positivePosts > negativePosts) {
    positiveDrivers.push("Collector sentiment on Reddit skews positive.");
  }
  if (negativePosts > positivePosts) {
    negativeDrivers.push("Negative Reddit threads are outweighing positive posts.");
  }
  if (commonTopics.length > 0) {
    positiveDrivers.push(`Common topics: ${commonTopics.slice(0, 3).join(", ")}.`);
  }

  return {
    score,
    positiveDrivers,
    negativeDrivers,
    dataPointCount: posts.length,
  };
}
