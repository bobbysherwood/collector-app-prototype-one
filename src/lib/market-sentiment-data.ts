import { createClient } from "@/lib/supabase/server";
import {
  getDefaultMarketSentimentSources,
  isMissingSentimentSourcesTableError,
} from "@/lib/market-sentiment-defaults";
import type { MarketSentimentSource } from "@/types/market-sentiment";

function mapRow(row: {
  id: string;
  slug: string;
  name: string;
  description: string;
  weight_percent: number;
  active: boolean;
  sort_order: number;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}): MarketSentimentSource {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    weightPercent: row.weight_percent,
    active: row.active,
    sortOrder: row.sort_order,
    config: row.config ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMarketSentimentSources(options?: {
  activeOnly?: boolean;
}): Promise<MarketSentimentSource[]> {
  const { sources } = await getMarketSentimentSourcesWithMeta(options);
  return sources;
}

export async function getMarketSentimentSourcesWithMeta(options?: {
  activeOnly?: boolean;
}): Promise<{ sources: MarketSentimentSource[]; usingDefaults: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("market_sentiment_sources")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingSentimentSourcesTableError(error)) {
      return {
        sources: getDefaultMarketSentimentSources(options),
        usingDefaults: true,
      };
    }
    return { sources: [], usingDefaults: false };
  }

  return {
    sources: (data ?? []).map(mapRow),
    usingDefaults: false,
  };
}

export async function getActiveMarketSentimentSources(): Promise<MarketSentimentSource[]> {
  return getMarketSentimentSources({ activeOnly: true });
}
