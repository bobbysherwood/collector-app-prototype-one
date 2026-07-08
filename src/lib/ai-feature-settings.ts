import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";
import {
  DEFAULT_AI_FEATURE_SETTINGS,
  type AiFeatureSettings,
  type UserFeatureSettingsMap,
} from "@/types/ai-features";

function mapRow(row: {
  portfolio_insights_enabled: boolean;
  market_research_enabled: boolean;
}): AiFeatureSettings {
  return {
    portfolioInsightsEnabled: row.portfolio_insights_enabled,
    marketResearchEnabled: row.market_research_enabled,
  };
}

export async function getAiFeatureSettings(): Promise<AiFeatureSettings> {
  const user = await getCurrentUser();
  if (!user) {
    return DEFAULT_AI_FEATURE_SETTINGS;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_feature_settings")
    .select("portfolio_insights_enabled, market_research_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_AI_FEATURE_SETTINGS;
  }

  return mapRow(data);
}

export async function getAdminUserFeatureSettingsMap(): Promise<UserFeatureSettingsMap> {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return {};
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_feature_settings")
    .select("user_id, portfolio_insights_enabled, market_research_enabled");

  if (error || !data) {
    return {};
  }

  return Object.fromEntries(
    data.map((row) => [
      row.user_id,
      mapRow(row),
    ])
  );
}
