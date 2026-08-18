import { createClient } from "@/lib/supabase/server";
import {
  normalizeSportMarketIndexConfigRow,
} from "@/lib/market-index/config/normalize-db-config";
import {
  getDefaultSportMarketIndexConfigs,
  isMissingSportMarketIndexTableError,
} from "@/lib/market-index-defaults";
import type {
  SportMarketFeatureRecord,
  SportMarketIndexConfig,
} from "@/types/market-index";
import type { SportMarketIndexResult } from "@/types/market-index";

function mapConfigRow(row: {
  id: string;
  name: string;
  active: boolean;
  pick_list_sport_id: string | null;
  season_config: unknown;
  search_terms: unknown;
  provider_config: unknown;
  index_weights: unknown;
  forecast_config: unknown;
  season_modifiers: unknown;
  risk_thresholds: unknown;
  sort_order: number;
  created_at: string;
  updated_at: string;
}): SportMarketIndexConfig {
  return normalizeSportMarketIndexConfigRow(row);
}

function mapFeatureRow(row: {
  sport_id: string;
  feature_key: string;
  feature_category: string;
  value: number;
  z_score: number | null;
  delta_30d_pct: number | null;
  provider_slug: string;
  observed_at: string;
  metadata: Record<string, unknown> | null;
}): SportMarketFeatureRecord {
  return {
    sportId: row.sport_id,
    featureKey: row.feature_key,
    featureCategory: row.feature_category as SportMarketFeatureRecord["featureCategory"],
    value: Number(row.value),
    zScore: row.z_score,
    delta30dPct: row.delta_30d_pct,
    providerSlug: row.provider_slug,
    observedAt: row.observed_at,
    metadata: row.metadata ?? {},
  };
}

export async function getSportMarketIndexConfigsWithMeta(): Promise<{
  configs: SportMarketIndexConfig[];
  usingDefaults: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sport_market_index_configs")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    if (isMissingSportMarketIndexTableError(error)) {
      return {
        configs: getDefaultSportMarketIndexConfigs(),
        usingDefaults: true,
      };
    }
    return { configs: [], usingDefaults: false };
  }

  return {
    configs: (data ?? []).map(mapConfigRow),
    usingDefaults: false,
  };
}

export async function getSportMarketIndexConfig(
  sportId: string
): Promise<SportMarketIndexConfig | null> {
  const { configs, usingDefaults } = await getSportMarketIndexConfigsWithMeta();
  if (usingDefaults) {
    return configs.find((config) => config.id === sportId) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sport_market_index_configs")
    .select("*")
    .eq("id", sportId)
    .maybeSingle();

  if (error || !data) {
    return configs.find((config) => config.id === sportId) ?? null;
  }

  return mapConfigRow(data);
}

export async function getLatestSportMarketFeatures(
  sportId: string,
  beforeDate?: string
): Promise<SportMarketFeatureRecord[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sport_market_features")
    .select("*")
    .eq("sport_id", sportId)
    .order("observed_at", { ascending: false })
    .limit(200);

  if (beforeDate) {
    query = query.lt("observed_at", beforeDate);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingSportMarketIndexTableError(error)) return [];
    return [];
  }

  const latestDate = data?.[0]?.observed_at;
  if (!latestDate) return [];

  return (data ?? [])
    .filter((row) => row.observed_at === latestDate)
    .map(mapFeatureRow);
}

export async function upsertSportMarketFeatures(input: {
  sportId: string;
  observedAt: string;
  observations: Array<{
    featureKey: string;
    featureCategory: string;
    value: number;
    delta30dPct?: number | null;
    providerSlug: string;
    metadata?: Record<string, unknown>;
  }>;
}): Promise<void> {
  const supabase = await createClient();
  const rows = input.observations.map((observation) => ({
    sport_id: input.sportId,
    feature_key: observation.featureKey,
    feature_category: observation.featureCategory,
    value: observation.value,
    delta_30d_pct: observation.delta30dPct ?? null,
    provider_slug: observation.providerSlug,
    observed_at: input.observedAt,
    metadata: observation.metadata ?? {},
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("sport_market_features").upsert(rows, {
    onConflict: "sport_id,feature_key,observed_at",
  });

  if (error && !isMissingSportMarketIndexTableError(error)) {
    console.error("Failed to upsert sport market features:", error.message);
  }
}

export async function insertSportMarketIndexSnapshot(input: {
  sportId: string;
  result: SportMarketIndexResult;
}): Promise<string | null> {
  const supabase = await createClient();
  const computedAt = input.result.asOf;

  const { data, error } = await supabase
    .from("sport_market_index_snapshots")
    .insert({
      sport_id: input.sportId,
      health_score: input.result.healthScore,
      momentum_score: input.result.momentumScore,
      outlook_score: input.result.outlookScore,
      forecast_3m_pct: input.result.forecast3mPct,
      forecast_6m_pct: input.result.forecast6mPct,
      forecast_12m_pct: input.result.forecast12mPct,
      confidence_score: input.result.confidenceScore,
      risk_rating: input.result.riskRating,
      positive_drivers: input.result.positiveDrivers,
      negative_drivers: input.result.negativeDrivers,
      explanation: input.result.explanation,
      feature_snapshot: input.result.featureSnapshot ?? {},
      model_version: input.result.modelVersion,
      computed_at: computedAt,
    })
    .select("id")
    .single();

  if (error) {
    if (!isMissingSportMarketIndexTableError(error)) {
      console.error("Failed to insert sport market index snapshot:", error.message);
    }
    return null;
  }

  return data?.id ?? null;
}
