import { createClient } from "@/lib/supabase/server";
import { getPortfolioData } from "@/lib/data";
import {
  buildPortfolioInsightSnapshot,
  computePortfolioSnapshotHash,
} from "@/lib/portfolio-insight-snapshot";
import { generatePortfolioInsightsWithOpenAI } from "@/lib/portfolio-insights-ai";
import type {
  PortfolioInsight,
  PortfolioInsightsResult,
} from "@/types/portfolio-insights";
import { PORTFOLIO_INSIGHTS_PROMPT_VERSION } from "@/types/portfolio-insights";

interface CachedInsightsRow {
  snapshot_hash: string;
  prompt_version: string;
  insights: PortfolioInsight[];
  summary: string | null;
  generated_at: string;
  generated_for_login_at: string | null;
}

function loginRequiresRegeneration(
  lastLoginAt: string | null,
  cache: CachedInsightsRow | null
): boolean {
  if (!lastLoginAt || !cache) return false;
  if (!cache.generated_for_login_at) return true;

  return (
    new Date(lastLoginAt).getTime() >
    new Date(cache.generated_for_login_at).getTime()
  );
}

function mapCacheRow(row: CachedInsightsRow): PortfolioInsightsResult {
  return {
    insights: row.insights,
    summary: row.summary,
    generatedAt: row.generated_at,
    fromCache: true,
  };
}

export async function getPortfolioInsights(): Promise<PortfolioInsightsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      insights: [],
      summary: null,
      generatedAt: new Date().toISOString(),
      fromCache: false,
      error: "Not authenticated.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_login_at")
    .eq("id", user.id)
    .maybeSingle();

  const lastLoginAt = profile?.last_login_at ?? null;
  const portfolioData = await getPortfolioData();
  const snapshot = buildPortfolioInsightSnapshot(portfolioData);
  const snapshotHash = computePortfolioSnapshotHash(snapshot);

  const { data: cache, error: cacheError } = await supabase
    .from("portfolio_insights_cache")
    .select(
      "snapshot_hash, prompt_version, insights, summary, generated_at, generated_for_login_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (cacheError) {
    console.error("Failed to load portfolio insights cache:", cacheError.message);
  }

  const cachedRow = cache as CachedInsightsRow | null;
  const shouldUseCache =
    cachedRow &&
    cachedRow.prompt_version === PORTFOLIO_INSIGHTS_PROMPT_VERSION &&
    cachedRow.snapshot_hash === snapshotHash &&
    !loginRequiresRegeneration(lastLoginAt, cachedRow);

  if (shouldUseCache && cachedRow) {
    return mapCacheRow(cachedRow);
  }

  try {
    const generated = await generatePortfolioInsightsWithOpenAI(snapshot);
    const generatedAt = new Date().toISOString();

    const { error: upsertError } = await supabase
      .from("portfolio_insights_cache")
      .upsert({
        user_id: user.id,
        snapshot_hash: snapshotHash,
        prompt_version: PORTFOLIO_INSIGHTS_PROMPT_VERSION,
        insights: generated.insights,
        summary: generated.summary,
        model: generated.model,
        generated_at: generatedAt,
        generated_for_login_at: lastLoginAt,
        input_tokens: generated.inputTokens,
        output_tokens: generated.outputTokens,
      });

    if (upsertError) {
      console.error(
        "Failed to save portfolio insights cache:",
        upsertError.message
      );
    }

    return {
      insights: generated.insights,
      summary: generated.summary,
      generatedAt,
      fromCache: false,
    };
  } catch (error) {
    console.error("Failed to generate portfolio insights:", error);

    if (cachedRow) {
      return {
        ...mapCacheRow(cachedRow),
        error: "Unable to refresh insights. Showing your last saved insights.",
      };
    }

    return {
      insights: [],
      summary: null,
      generatedAt: new Date().toISOString(),
      fromCache: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to generate portfolio insights.",
    };
  }
}
