import type { MarketSentimentAnalysisInput, MarketSentimentTrend } from "@/types/market-sentiment";
import { MARKET_SENTIMENT_TREND_LABELS } from "@/types/market-sentiment";

interface ExplainabilityInput {
  input: MarketSentimentAnalysisInput;
  demandSentimentScore: number;
  trend: MarketSentimentTrend;
  confidenceScore: number;
  positiveDrivers: string[];
  negativeDrivers: string[];
  sourceScores: Array<{
    name: string;
    score: number;
    weightPercent: number;
  }>;
}

export function buildExplainability(payload: ExplainabilityInput): {
  summary: string;
  explanation: string;
} {
  const trendLabel = MARKET_SENTIMENT_TREND_LABELS[payload.trend].toLowerCase();
  const player = payload.input.playerName;

  const summary = `Collector demand for ${player} appears ${trendLabel} with a sentiment score of ${payload.demandSentimentScore}/100 and ${payload.confidenceScore}% confidence based on public news, community, video, social, and search signals.`;

  const driverLines =
    payload.positiveDrivers.length > 0
      ? payload.positiveDrivers.map((driver) => `• ${driver}`).join("\n")
      : "• Limited positive drivers were detected across public sources.";

  const riskLines =
    payload.negativeDrivers.length > 0
      ? payload.negativeDrivers.map((driver) => `• ${driver}`).join("\n")
      : "• No major negative drivers were detected.";

  const topSources = [...payload.sourceScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((source) => `${source.name} (${source.score}/100 at ${source.weightPercent}% weight)`)
    .join(", ");

  const explanation = [
    `Demand is ${trendLabel} because:`,
    "",
    driverLines,
    "",
    "Risks:",
    "",
    riskLines,
    "",
    `Strongest source signals: ${topSources}.`,
  ].join("\n");

  return { summary, explanation };
}
