"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";
import type { AiFeatureSettings } from "@/types/ai-features";

async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Unauthorized" as const };
  }
  return { error: null };
}

export async function updateUserFeatureSettings(
  userId: string,
  settings: AiFeatureSettings
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("user_feature_settings").upsert({
    user_id: userId,
    portfolio_insights_enabled: settings.portfolioInsightsEnabled,
    market_research_enabled: settings.marketResearchEnabled,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/market-research");
  revalidatePath("/dashboard", "layout");

  return {};
}
