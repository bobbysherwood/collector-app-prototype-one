import { createClient } from "@/lib/supabase/server";
import type {
  PlayerCardOpportunity,
  PlayerOpportunity,
} from "@/types/player-opportunity";

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    Boolean(error.message?.includes("player_opportunity_snapshots")) ||
    Boolean(error.message?.includes("player_card_opportunity_snapshots"))
  );
}

export async function insertPlayerOpportunitySnapshot(input: {
  playerId: string;
  opportunity: PlayerOpportunity;
}): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_opportunity_snapshots")
    .insert({
      player_id: input.playerId,
      opportunity: input.opportunity,
      model_version: input.opportunity.modelVersion,
      computed_at: input.opportunity.computedAt,
    })
    .select("id")
    .single();

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Failed to insert player opportunity snapshot:", error.message);
    }
    return null;
  }

  return data?.id ?? null;
}

export async function insertPlayerCardOpportunitySnapshot(input: {
  assetId: string;
  opportunity: PlayerCardOpportunity;
}): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_card_opportunity_snapshots")
    .insert({
      asset_id: input.assetId,
      opportunity: input.opportunity,
      model_version: input.opportunity.modelVersion,
      computed_at: input.opportunity.computedAt,
    })
    .select("id")
    .single();

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Failed to insert player card opportunity snapshot:", error.message);
    }
    return null;
  }

  return data?.id ?? null;
}

export async function insertPlayerOpportunityPrediction(input: {
  playerId: string;
  assetId?: string | null;
  asOf: string;
  horizonDays: number;
  predictedScore: number;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_opportunity_prediction_history")
    .insert({
      player_id: input.playerId,
      asset_id: input.assetId ?? null,
      as_of: input.asOf,
      horizon_days: input.horizonDays,
      predicted_score: input.predictedScore,
      inputs: input.inputs,
      outputs: input.outputs,
    })
    .select("id")
    .single();

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Failed to insert player opportunity prediction:", error.message);
    }
    return null;
  }

  return data?.id ?? null;
}

export async function persistPlayerOpportunity(
  opportunity: PlayerOpportunity,
  assetId?: string
): Promise<void> {
  await insertPlayerOpportunitySnapshot({
    playerId: opportunity.playerId,
    opportunity,
  });

  await insertPlayerOpportunityPrediction({
    playerId: opportunity.playerId,
    assetId: assetId ?? null,
    asOf: opportunity.computedAt,
    horizonDays: 90,
    predictedScore: opportunity.opportunityScore,
    inputs: opportunity.inputs,
    outputs: {
      opportunityScore: opportunity.opportunityScore,
      expectedDemandChange90d: opportunity.expectedDemandChange90d,
      trend: opportunity.trend,
    },
  });
}

const SNAPSHOT_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;

export async function listPlayerOpportunitySnapshots(
  playerId: string,
  limit = 365
): Promise<Array<{ computedAt: string; opportunityScore: number }>> {
  const trimmed = playerId.trim();
  if (!trimmed) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_opportunity_snapshots")
    .select("computed_at, opportunity")
    .eq("player_id", trimmed)
    .order("computed_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Failed to list player opportunity snapshots:", error.message);
    }
    return [];
  }

  return (data ?? []).flatMap((row) => {
    const score = (row.opportunity as { opportunityScore?: unknown } | null)
      ?.opportunityScore;
    if (typeof score !== "number" || !Number.isFinite(score)) return [];
    return [
      {
        computedAt: row.computed_at,
        opportunityScore: score,
      },
    ];
  });
}

export async function getLatestPlayerOpportunitySnapshot(
  playerId: string
): Promise<{ computedAt: string; opportunityScore: number } | null> {
  const trimmed = playerId.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_opportunity_snapshots")
    .select("computed_at, opportunity")
    .eq("player_id", trimmed)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Failed to read latest player opportunity snapshot:", error.message);
    }
    return null;
  }
  if (!data) return null;

  const score = (data.opportunity as { opportunityScore?: unknown } | null)
    ?.opportunityScore;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return { computedAt: data.computed_at, opportunityScore: score };
}

export async function recordPlayerOpportunitySnapshotIfStale(
  opportunity: PlayerOpportunity
): Promise<void> {
  const latest = await getLatestPlayerOpportunitySnapshot(opportunity.playerId);
  if (latest) {
    const age = Date.now() - Date.parse(latest.computedAt);
    if (Number.isFinite(age) && age < SNAPSHOT_MIN_INTERVAL_MS) return;
  }
  await persistPlayerOpportunity(opportunity);
}

export async function persistPlayerCardOpportunity(
  opportunity: PlayerCardOpportunity
): Promise<void> {
  await insertPlayerCardOpportunitySnapshot({
    assetId: opportunity.cardId,
    opportunity,
  });

  await insertPlayerOpportunityPrediction({
    playerId: opportunity.playerId,
    assetId: opportunity.cardId,
    asOf: opportunity.computedAt,
    horizonDays: 90,
    predictedScore: opportunity.opportunityScore,
    inputs: opportunity.inputs,
    outputs: {
      opportunityScore: opportunity.opportunityScore,
      recommendation: opportunity.recommendation,
      expectedReturn90d: opportunity.expectedReturn90d,
      playerOpportunityScore: opportunity.playerOpportunityScore,
    },
  });
}
