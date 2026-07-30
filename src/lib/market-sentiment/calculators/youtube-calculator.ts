import { clampScore } from "@/lib/market-sentiment/fetch-utils";
import type {
  ScraperResult,
  SourceCalculatorResult,
  YouTubeScrapeData,
} from "@/lib/market-sentiment/internal-types";

export function calculateYouTubeScore(
  result: ScraperResult<YouTubeScrapeData>
): SourceCalculatorResult {
  const { videos, totalViews } = result.data;
  if (videos.length === 0) {
    return {
      score: 50,
      positiveDrivers: [],
      negativeDrivers: ["No recent YouTube coverage found."],
      dataPointCount: 0,
    };
  }

  const positiveVideos = videos.filter((video) => video.sentiment === "positive").length;
  const negativeVideos = videos.filter((video) => video.sentiment === "negative").length;
  const sentimentRatio = (positiveVideos - negativeVideos) / videos.length;

  const countScore = Math.min(30, videos.length * 4);
  const viewScore = Math.min(25, totalViews / 50_000);
  const score = clampScore(50 + sentimentRatio * 20 + countScore * 0.5 + viewScore);

  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  if (videos.length >= 3) {
    positiveDrivers.push("Multiple YouTube channels recently featured the player.");
  }
  if (positiveVideos > 0) {
    positiveDrivers.push(`${positiveVideos} video title(s) show positive investment sentiment.`);
  }
  if (negativeVideos > 0) {
    negativeDrivers.push(`${negativeVideos} video title(s) signal caution or declining hype.`);
  }

  return {
    score,
    positiveDrivers,
    negativeDrivers,
    dataPointCount: videos.length,
  };
}
