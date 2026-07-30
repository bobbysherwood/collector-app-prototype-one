import { clampScore } from "@/lib/market-sentiment/fetch-utils";
import type {
  ScraperResult,
  SearchInterestScrapeData,
  SourceCalculatorResult,
} from "@/lib/market-sentiment/internal-types";

export function calculateSearchInterestScore(
  result: ScraperResult<SearchInterestScrapeData>
): SourceCalculatorResult {
  const { trendScore, direction, growthPercent, relatedQueries } = result.data;

  let score = trendScore;
  if (direction === "up") score += 10;
  if (direction === "down") score -= 10;
  if (growthPercent != null) {
    score += Math.max(-15, Math.min(15, growthPercent / 3));
  }
  score = clampScore(score);

  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  if (direction === "up") {
    positiveDrivers.push("Search interest is trending upward.");
  }
  if (direction === "down") {
    negativeDrivers.push("Search interest is declining versus the prior period.");
  }
  if (growthPercent != null && growthPercent > 15) {
    positiveDrivers.push(`Search interest grew ${Math.round(growthPercent)}% recently.`);
  }
  if (relatedQueries.length > 0) {
    positiveDrivers.push(`Related searches: ${relatedQueries.slice(0, 3).join(", ")}.`);
  }
  if (result.dataPointCount === 0) {
    negativeDrivers.push("Search interest data was limited or unavailable.");
  }

  return {
    score,
    positiveDrivers,
    negativeDrivers,
    dataPointCount: result.dataPointCount,
  };
}
