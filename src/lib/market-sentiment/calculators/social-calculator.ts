import { clampScore } from "@/lib/market-sentiment/fetch-utils";
import type {
  ScraperResult,
  SocialScrapeData,
  SourceCalculatorResult,
} from "@/lib/market-sentiment/internal-types";

export function calculateSocialScore(
  result: ScraperResult<SocialScrapeData>
): SourceCalculatorResult {
  const { posts, mentionCount, totalEngagement, trendingHashtags } = result.data;
  if (posts.length === 0) {
    return {
      score: 50,
      positiveDrivers: [],
      negativeDrivers: ["Limited public social mention activity."],
      dataPointCount: 0,
    };
  }

  const positivePosts = posts.filter((post) => post.sentiment === "positive").length;
  const negativePosts = posts.filter((post) => post.sentiment === "negative").length;
  const sentimentRatio = (positivePosts - negativePosts) / posts.length;

  const mentionScore = Math.min(30, mentionCount * 3);
  const engagementScore = Math.min(20, totalEngagement / 10);
  const score = clampScore(50 + sentimentRatio * 25 + mentionScore * 0.4 + engagementScore * 0.4);

  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  if (mentionCount >= 5) {
    positiveDrivers.push("Social mention volume is elevated this period.");
  }
  if (positivePosts > negativePosts) {
    positiveDrivers.push("Social chatter skews positive.");
  }
  if (negativePosts > positivePosts) {
    negativeDrivers.push("Negative social posts are trending.");
  }
  if (trendingHashtags.length > 0) {
    positiveDrivers.push(`Trending tags: ${trendingHashtags.slice(0, 3).join(", ")}.`);
  }

  return {
    score,
    positiveDrivers,
    negativeDrivers,
    dataPointCount: mentionCount,
  };
}
