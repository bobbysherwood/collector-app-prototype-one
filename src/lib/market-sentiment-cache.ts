import { createClient } from "@/lib/supabase/server";
import type {
  MarketSentimentAnalysisInput,
  MarketSentimentAnalysisResult,
} from "@/types/market-sentiment";

export const MARKET_SENTIMENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function isMarketSentimentCacheFresh(
  fetchedAt: string,
  now = Date.now()
): boolean {
  const timestamp = Date.parse(fetchedAt);
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp < MARKET_SENTIMENT_CACHE_TTL_MS;
}

function isMissingSentimentCacheTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("market_sentiment_cache") ?? false)
  );
}

export async function getCachedMarketSentiment(
  cardId: string
): Promise<{ result: MarketSentimentAnalysisResult; fetchedAt: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_sentiment_cache")
    .select("result, fetched_at")
    .eq("card_id", cardId)
    .maybeSingle();

  if (error) {
    if (!isMissingSentimentCacheTableError(error)) {
      console.error("Failed to read market sentiment cache:", error.message);
    }
    return null;
  }

  if (!data?.result || !data.fetched_at) return null;
  if (!isMarketSentimentCacheFresh(data.fetched_at)) return null;

  return {
    result: data.result as MarketSentimentAnalysisResult,
    fetchedAt: data.fetched_at,
  };
}

export async function upsertMarketSentimentCache(input: {
  cardId: string;
  result: MarketSentimentAnalysisResult;
  analysisInput: MarketSentimentAnalysisInput;
}): Promise<string | null> {
  const supabase = await createClient();
  const fetchedAt = new Date().toISOString();

  const { error } = await supabase.from("market_sentiment_cache").upsert(
    {
      card_id: input.cardId,
      result: input.result,
      input: input.analysisInput,
      fetched_at: fetchedAt,
    },
    { onConflict: "card_id" }
  );

  if (error) {
    if (!isMissingSentimentCacheTableError(error)) {
      console.error("Failed to write market sentiment cache:", error.message);
    }
    return null;
  }

  return fetchedAt;
}
