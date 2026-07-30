import { clampScore, daysSince, recencyMultiplier } from "@/lib/market-sentiment/fetch-utils";
import type {
  NewsScrapeData,
  ScraperResult,
  SourceCalculatorResult,
} from "@/lib/market-sentiment/internal-types";

export function calculateNewsScore(
  result: ScraperResult<NewsScrapeData>
): SourceCalculatorResult {
  const articles = result.data.articles;
  if (articles.length === 0) {
    return {
      score: 50,
      positiveDrivers: [],
      negativeDrivers: ["No recent news coverage found."],
      dataPointCount: 0,
    };
  }

  let weighted = 0;
  let weightTotal = 0;
  let positive = 0;
  let negative = 0;
  const sourceNames = new Set<string>();

  for (const article of articles) {
    const recency = recencyMultiplier(daysSince(article.publishDate));
    const weight = article.importanceScore * recency;
    const sentimentValue =
      article.sentiment === "positive" ? 1 : article.sentiment === "negative" ? -1 : 0;

    weighted += (50 + sentimentValue * 35) * weight;
    weightTotal += weight;
    sourceNames.add(article.source);
    if (article.sentiment === "positive") positive += 1;
    if (article.sentiment === "negative") negative += 1;
  }

  const volumeBoost = Math.min(15, articles.length * 2);
  const score = clampScore((weighted / Math.max(weightTotal, 1)) + volumeBoost);

  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  if (positive > 0) {
    positiveDrivers.push(
      `${sourceNames.size} outlet(s) published ${positive} positive article(s) recently.`
    );
  }
  if (negative > 0) {
    negativeDrivers.push(`${negative} negative news headline(s) detected this week.`);
  }
  if (articles.length >= 5) {
    positiveDrivers.push("Strong news volume indicates elevated attention.");
  }

  return {
    score,
    positiveDrivers,
    negativeDrivers,
    dataPointCount: articles.length,
  };
}
