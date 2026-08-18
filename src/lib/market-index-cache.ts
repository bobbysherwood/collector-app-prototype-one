import { createClient } from "@/lib/supabase/server";
import { isMissingSportMarketIndexTableError } from "@/lib/market-index-defaults";
import type { SportMarketIndexResult } from "@/types/market-index";

export const SPORT_MARKET_INDEX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function isSportMarketIndexCacheFresh(
  fetchedAt: string,
  now = Date.now()
): boolean {
  const timestamp = Date.parse(fetchedAt);
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp < SPORT_MARKET_INDEX_CACHE_TTL_MS;
}

export async function getCachedSportMarketIndex(
  sportId: string
): Promise<{ result: SportMarketIndexResult; fetchedAt: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sport_market_index_cache")
    .select("result, fetched_at")
    .eq("sport_id", sportId)
    .maybeSingle();

  if (error) {
    if (!isMissingSportMarketIndexTableError(error)) {
      console.error("Failed to read sport market index cache:", error.message);
    }
    return null;
  }

  if (!data?.result || !data.fetched_at) return null;
  if (!isSportMarketIndexCacheFresh(data.fetched_at)) return null;

  return {
    result: data.result as SportMarketIndexResult,
    fetchedAt: data.fetched_at,
  };
}

export async function upsertSportMarketIndexCache(input: {
  sportId: string;
  result: SportMarketIndexResult;
}): Promise<string | null> {
  const supabase = await createClient();
  const fetchedAt = new Date().toISOString();

  const { error } = await supabase.from("sport_market_index_cache").upsert(
    {
      sport_id: input.sportId,
      result: input.result,
      fetched_at: fetchedAt,
    },
    { onConflict: "sport_id" }
  );

  if (error) {
    if (!isMissingSportMarketIndexTableError(error)) {
      console.error("Failed to write sport market index cache:", error.message);
    }
    return null;
  }

  return fetchedAt;
}

export async function getLatestSportMarketIndexSnapshot(
  sportId: string
): Promise<{ result: SportMarketIndexResult; computedAt: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sport_market_index_snapshots")
    .select("*")
    .eq("sport_id", sportId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error && !isMissingSportMarketIndexTableError(error)) {
      console.error("Failed to read sport market index snapshot:", error.message);
    }
    return null;
  }

  const result: SportMarketIndexResult = {
    sportId: data.sport_id,
    sportName: "",
    healthScore: data.health_score,
    momentumScore: data.momentum_score,
    outlookScore: data.outlook_score,
    forecast3mPct: Number(data.forecast_3m_pct),
    forecast6mPct: Number(data.forecast_6m_pct),
    forecast12mPct: Number(data.forecast_12m_pct),
    confidenceScore: data.confidence_score,
    riskRating: data.risk_rating,
    positiveDrivers: data.positive_drivers ?? [],
    negativeDrivers: data.negative_drivers ?? [],
    explanation: data.explanation ?? "",
    modelVersion: data.model_version,
    seasonPhase: "regular",
    asOf: data.computed_at,
    featureSnapshot: data.feature_snapshot,
  };

  return { result, computedAt: data.computed_at };
}
