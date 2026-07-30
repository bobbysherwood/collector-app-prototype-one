"use server";

import {
  getCachedMarketSentiment,
  upsertMarketSentimentCache,
} from "@/lib/market-sentiment-cache";
import { runMarketSentimentAnalysis, validateActiveSourceWeights } from "@/lib/market-sentiment/engine";
import { getActiveMarketSentimentSources } from "@/lib/market-sentiment-data";
import type {
  MarketSentimentAnalysisInput,
  MarketSentimentAnalysisResult,
} from "@/types/market-sentiment";

export interface MarketSentimentAnalysisResponse {
  error?: string;
  result?: MarketSentimentAnalysisResult;
  fromCache?: boolean;
  cachedAt?: string;
}

function normalizeInput(input: MarketSentimentAnalysisInput) {
  const playerName = input.playerName?.trim();
  if (!playerName) {
    return { error: "Player name is required." as const };
  }
  return {
    playerName,
    normalized: { ...input, playerName } satisfies MarketSentimentAnalysisInput,
  };
}

async function runFreshAnalysis(
  normalized: MarketSentimentAnalysisInput
): Promise<{ error?: string; result?: MarketSentimentAnalysisResult }> {
  const sources = await getActiveMarketSentimentSources();
  if (sources.length === 0) {
    return { error: "No active sentiment sources are configured." };
  }

  const weightValidation = validateActiveSourceWeights(sources);
  if (!weightValidation.valid) {
    return { error: weightValidation.message };
  }

  try {
    const result = await runMarketSentimentAnalysis(normalized, sources);
    return { result };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Market sentiment analysis failed.",
    };
  }
}

export async function getMarketSentimentAnalysis(
  cardId: string,
  input: MarketSentimentAnalysisInput
): Promise<MarketSentimentAnalysisResponse> {
  const parsed = normalizeInput(input);
  if ("error" in parsed) return { error: parsed.error };

  const cached = await getCachedMarketSentiment(cardId);
  if (cached) {
    return {
      result: cached.result,
      fromCache: true,
      cachedAt: cached.fetchedAt,
    };
  }

  return { result: undefined };
}

export async function analyzeMarketSentiment(
  cardId: string,
  input: MarketSentimentAnalysisInput,
  options?: { refresh?: boolean }
): Promise<MarketSentimentAnalysisResponse> {
  const parsed = normalizeInput(input);
  if ("error" in parsed) return { error: parsed.error };

  if (!options?.refresh) {
    const cached = await getCachedMarketSentiment(cardId);
    if (cached) {
      return {
        result: cached.result,
        fromCache: true,
        cachedAt: cached.fetchedAt,
      };
    }
  }

  const fresh = await runFreshAnalysis(parsed.normalized);
  if (fresh.error || !fresh.result) {
    return { error: fresh.error ?? "Market sentiment analysis failed." };
  }

  const cachedAt =
    (await upsertMarketSentimentCache({
      cardId,
      result: fresh.result,
      analysisInput: parsed.normalized,
    })) ?? fresh.result.asOf;

  return {
    result: fresh.result,
    fromCache: false,
    cachedAt,
  };
}
