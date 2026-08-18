import { createClient } from "@/lib/supabase/server";
import type {
  CardInvestmentProfile,
  CardInvestmentSnapshotRow,
} from "@/types/card-investment";

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    Boolean(error.message?.includes("card_investment_snapshots"))
  );
}

export async function insertCardInvestmentSnapshot(input: {
  assetId: string;
  profile: CardInvestmentProfile;
}): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_investment_snapshots")
    .insert({
      asset_id: input.assetId,
      profile: input.profile,
      model_version: input.profile.modelVersion,
      computed_at: input.profile.computedAt,
    })
    .select("id")
    .single();

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Failed to insert card investment snapshot:", error.message);
    }
    return null;
  }

  return data?.id ?? null;
}

export async function getLatestCardInvestmentSnapshot(
  assetId: string
): Promise<CardInvestmentSnapshotRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_investment_snapshots")
    .select("*")
    .eq("asset_id", assetId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error && !isMissingTableError(error)) {
      console.error("Failed to read card investment snapshot:", error.message);
    }
    return null;
  }

  return {
    id: data.id,
    assetId: data.asset_id,
    profile: data.profile as CardInvestmentProfile,
    modelVersion: data.model_version,
    computedAt: data.computed_at,
  };
}

export async function insertCardInvestmentPrediction(input: {
  assetId: string;
  asOf: string;
  horizonDays: number;
  predictedValue: number | null;
  actualValue?: number | null;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_investment_prediction_history")
    .insert({
      asset_id: input.assetId,
      as_of: input.asOf,
      horizon_days: input.horizonDays,
      predicted_value: input.predictedValue,
      actual_value: input.actualValue ?? null,
      inputs: input.inputs,
      outputs: input.outputs,
    })
    .select("id")
    .single();

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Failed to insert card investment prediction:", error.message);
    }
    return null;
  }

  return data?.id ?? null;
}

export async function persistCardInvestmentProfile(
  profile: CardInvestmentProfile
): Promise<void> {
  await insertCardInvestmentSnapshot({
    assetId: profile.assetId,
    profile,
  });

  await insertCardInvestmentPrediction({
    assetId: profile.assetId,
    asOf: profile.computedAt,
    horizonDays: profile.forecast.horizonDays,
    predictedValue: profile.forecast.predictedValue,
    inputs: profile.inputs,
    outputs: {
      forecast: profile.forecast,
      recommendation: profile.recommendation,
      valuation: profile.valuation,
    },
  });
}
