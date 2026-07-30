import { estimateMarketValue } from "@/lib/market-sales/estimate";
import { computeRecentSalesTrend } from "@/lib/market-sales/trend";
import type { Asset } from "@/types/asset";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";
import type {
  MarketIndexSnapshot,
  MarketOutlook,
  MarketPredictionInsight,
  MarketTrendDirection,
} from "@/types/market-predictions";
import type { MarketSale } from "@/types/market-sales";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function primaryPlayer(player: string): string {
  return player.split("/")[0]?.trim() || player;
}

function seededChange(seed: number, slot: number, range = 18): number {
  const value = (seed + slot * 7919) % 1000;
  return Math.round(((value / 1000) * range * 2 - range) * 10) / 10;
}

function seededIndexValue(seed: number, slot: number): number {
  return Math.round((90 + ((seed + slot * 3571) % 140)) * 10) / 10;
}

function outlookFromSignals(
  trendChange30d: number,
  sportChange: number,
  playerChange: number,
  cardChange: number
): MarketOutlook {
  const composite =
    trendChange30d * 0.45 +
    playerChange * 0.25 +
    cardChange * 0.2 +
    sportChange * 0.1;

  if (composite >= 4) return "bullish";
  if (composite <= -4) return "bearish";
  return "neutral";
}

function buildTrendSummary(
  direction: MarketTrendDirection,
  change30d: number,
  volume30d: number,
  player: string
): string {
  const volumeLabel =
    volume30d >= 8
      ? "strong recent volume"
      : volume30d >= 4
        ? "moderate recent volume"
        : "light recent volume";

  if (direction === "up") {
    return `Recent comps for ${player} are trending up ${Math.abs(change30d).toFixed(1)}% over the last 30 days with ${volumeLabel}.`;
  }
  if (direction === "down") {
    return `Recent comps for ${player} are softening, down ${Math.abs(change30d).toFixed(1)}% over the last 30 days despite ${volumeLabel}.`;
  }
  return `Recent comps for ${player} are holding steady over the last 30 days with ${volumeLabel}.`;
}

function buildCommentary(
  context: PredictionCardContext,
  outlook: MarketOutlook,
  recentTrend: MarketPredictionInsight["recentTrend"],
  indexes: MarketIndexSnapshot[],
  currentEstimate: number | null,
  predictedChange30d: number,
  predictedChange90d: number
): string[] {
  const player = primaryPlayer(context.player);
  const parallel = context.parallelName;
  const sportIndex = indexes.find((index) => index.category === "sport");
  const playerIndex = indexes.find((index) => index.category === "player");
  const cardIndex = indexes.find((index) => index.category === "card");

  const sportChange = sportIndex?.change30d ?? 0;
  const playerIndexChange = playerIndex?.change30d ?? 0;
  const cardIndexChange = cardIndex?.change30d ?? 0;
  const cardSetLabel = context.cardSetName || context.brandName;

  const paragraphs: string[] = [
    `${player}'s ${context.year} ${context.brandName} ${cardSetLabel}${
      parallel ? ` (${parallel})` : ""
    } sits within a ${context.sportName.toLowerCase()} market that is ${
      sportChange >= 0 ? "firming" : "cooling"
    } at the sector level (${sportChange >= 0 ? "+" : ""}${sportChange.toFixed(
      1
    )}% on the ${sportIndex?.label ?? "sport index"} over 30 days).`,
    `At the player level, the ${playerIndex?.label ?? "player index"} is ${
      playerIndexChange >= 0 ? "outperforming" : "lagging"
    } the broader ${context.sportName.toLowerCase()} segment (${playerIndexChange >= 0 ? "+" : ""}${playerIndexChange.toFixed(
      1
    )}% over 30 days), while this specific card set cohort (${cardIndex?.label ?? "card index"}) is ${
      cardIndexChange >= 0 ? "tracking higher" : "trailing"
    } (${cardIndexChange.toFixed(1)}%).`,
  ];

  if (currentEstimate != null) {
    paragraphs.push(
      `Based on recent comps and index alignment, the model estimates a ${
        outlook === "bullish" ? "positive" : outlook === "bearish" ? "cautious" : "stable"
      } near-term path: ${predictedChange30d >= 0 ? "+" : ""}${predictedChange30d.toFixed(
        1
      )}% over 30 days and ${predictedChange90d >= 0 ? "+" : ""}${predictedChange90d.toFixed(
        1
      )}% over 90 days from a current comp anchor of $${currentEstimate.toFixed(2)}.`
    );
  }

  paragraphs.push(recentTrend.summary);

  if (parallel) {
    paragraphs.push(
      `${parallel} copies in this set typically trade at a premium to base when ${player} momentum is positive; watch for spread compression if sector volume fades.`
    );
  }

  return paragraphs;
}

function buildCatalysts(context: PredictionCardContext, seed: number): string[] {
  const player = primaryPlayer(context.player);
  const cardSetLabel = context.cardSetName || "this set";
  const options = [
    `${player} performance stretch or award recognition`,
    `Upcoming ${context.sportName.toLowerCase()} product releases competing for collector spend`,
    `New grading submissions affecting ${cardSetLabel} pop counts`,
    `Playoff or seasonal narrative driving hobby attention`,
    `Social media momentum around ${context.year} ${context.brandName} rookies`,
  ];

  const start = seed % options.length;
  return [
    options[start],
    options[(start + 2) % options.length],
    options[(start + 4) % options.length],
  ];
}

function buildRisks(
  context: PredictionCardContext,
  outlook: MarketOutlook,
  seed: number
): string[] {
  const player = primaryPlayer(context.player);
  const cardSetLabel = context.cardSetName || "this set";
  const options = [
    outlook === "bearish"
      ? "Continued softening in recent comp averages"
      : "Short-term profit-taking after a recent run-up",
    `Increased supply of ${cardSetLabel} parallels hitting the market`,
    `${player} injury or role change reducing demand`,
    "Broader macro pullback in high-end modern cards",
    context.parallelName
      ? `${context.parallelName} premium narrowing versus base copies`
      : "Base-card saturation within the set",
  ];

  const start = (seed >> 3) % options.length;
  return [options[start], options[(start + 1) % options.length]];
}

interface PredictionCardContext {
  id: string;
  player: string;
  year: number;
  sportName: string;
  brandName: string;
  cardSetName: string;
  parallelName: string | null;
}

function buildMockMarketPredictions(
  context: PredictionCardContext,
  sales: MarketSale[]
): MarketPredictionInsight {
  const seed = hashString(
    `${context.id}:${context.player}:${context.sportName}:${context.cardSetName}:${context.brandName}`
  );
  const player = primaryPlayer(context.player);
  const recentTrendMetrics = computeRecentSalesTrend(sales);
  const { change30d, volume30d, direction } = recentTrendMetrics;

  const sportChange = seededChange(seed, 1, 14);
  const playerChange = seededChange(seed, 2, 22);
  const cardChange = seededChange(seed, 3, 16);
  const cardSetLabel = context.cardSetName || context.brandName;

  const indexes: MarketIndexSnapshot[] = [
    {
      label: `${context.sportName} Cards Index`,
      category: "sport",
      value: seededIndexValue(seed, 4),
      change30d: sportChange,
    },
    {
      label: `${player} Index`,
      category: "player",
      value: seededIndexValue(seed, 5),
      change30d: playerChange,
    },
    {
      label: `${context.year} ${context.brandName} ${cardSetLabel} Index`,
      category: "card",
      value: seededIndexValue(seed, 6),
      change30d: cardChange,
    },
  ];

  const outlook = outlookFromSignals(change30d, sportChange, playerChange, cardChange);
  const estimate = estimateMarketValue(sales);
  const currentEstimate = estimate.value;

  const predictedChange30d =
    Math.round(
      (change30d * 0.35 +
        playerChange * 0.3 +
        cardChange * 0.2 +
        sportChange * 0.15) *
        10
    ) / 10;
  const predictedChange90d =
    Math.round((predictedChange30d * 1.6 + seededChange(seed, 7, 6)) * 10) / 10;

  const predictedValue30d =
    currentEstimate != null
      ? Math.round(currentEstimate * (1 + predictedChange30d / 100) * 100) / 100
      : null;
  const predictedValue90d =
    currentEstimate != null
      ? Math.round(currentEstimate * (1 + predictedChange90d / 100) * 100) / 100
      : null;

  const confidenceScore = estimate.confidence_score;
  const confidence: MarketPredictionInsight["confidence"] =
    confidenceScore >= 70 ? "high" : confidenceScore >= 40 ? "medium" : "low";

  const recentTrend = {
    ...recentTrendMetrics,
    summary: buildTrendSummary(direction, change30d, volume30d, player),
  };

  return {
    outlook,
    confidence,
    currentEstimate,
    predictedValue30d,
    predictedValue90d,
    predictedChange30d,
    predictedChange90d,
    recentTrend,
    indexes,
    commentary: buildCommentary(
      context,
      outlook,
      recentTrend,
      indexes,
      currentEstimate,
      predictedChange30d,
      predictedChange90d
    ),
    catalysts: buildCatalysts(context, seed),
    risks: buildRisks(context, outlook, seed),
    asOf: new Date().toISOString(),
  };
}

export function getMockMarketPredictionsForAsset(
  asset: Asset,
  sales: MarketSale[]
): MarketPredictionInsight {
  return buildMockMarketPredictions(
    {
      id: asset.id,
      player: asset.player_name,
      year: asset.year,
      sportName: asset.sport,
      brandName: asset.card_type,
      cardSetName: asset.card_set_name?.trim() || "",
      parallelName: asset.insert_parallel,
    },
    sales
  );
}

/**
 * Deterministic mock predictions for market research card detail.
 */
export function getMockMarketPredictions(
  card: Dm2CardSearchResult,
  sales: MarketSale[]
): MarketPredictionInsight {
  return buildMockMarketPredictions(
    {
      id: card.id,
      player: card.player,
      year: card.year,
      sportName: card.sportName,
      brandName: card.brandName,
      cardSetName: card.cardSetName,
      parallelName: card.parallelName,
    },
    sales
  );
}
