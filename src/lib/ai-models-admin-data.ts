import { createClient } from "@/lib/supabase/server";

function isMissingCardInvestmentTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "42P01" ||
    Boolean(error.message?.includes("card_investment_snapshots")) ||
    Boolean(error.message?.includes("card_investment_prediction_history"))
  );
}

function isMissingPlayerOpportunityTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "42P01" ||
    Boolean(error.message?.includes("player_opportunity_snapshots")) ||
    Boolean(error.message?.includes("player_card_opportunity_snapshots")) ||
    Boolean(error.message?.includes("player_opportunity_prediction_history"))
  );
}

export interface CardInvestmentAdminStats {
  usingDefaults: boolean;
  snapshotCount: number;
  predictionCount: number;
  latestComputedAt: string | null;
}

export interface PlayerOpportunityAdminStats {
  usingDefaults: boolean;
  playerSnapshotCount: number;
  cardSnapshotCount: number;
  predictionCount: number;
  latestPlayerComputedAt: string | null;
  latestCardComputedAt: string | null;
}

export async function getCardInvestmentAdminStats(): Promise<CardInvestmentAdminStats> {
  const supabase = await createClient();

  const snapshotQuery = await supabase
    .from("card_investment_snapshots")
    .select("*", { count: "exact", head: true });

  if (snapshotQuery.error) {
    if (isMissingCardInvestmentTableError(snapshotQuery.error)) {
      return {
        usingDefaults: true,
        snapshotCount: 0,
        predictionCount: 0,
        latestComputedAt: null,
      };
    }
    return {
      usingDefaults: false,
      snapshotCount: 0,
      predictionCount: 0,
      latestComputedAt: null,
    };
  }

  const predictionQuery = await supabase
    .from("card_investment_prediction_history")
    .select("*", { count: "exact", head: true });

  const latestQuery = await supabase
    .from("card_investment_snapshots")
    .select("computed_at")
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    usingDefaults: false,
    snapshotCount: snapshotQuery.count ?? 0,
    predictionCount: predictionQuery.error ? 0 : predictionQuery.count ?? 0,
    latestComputedAt: latestQuery.data?.computed_at ?? null,
  };
}

export async function getPlayerOpportunityAdminStats(): Promise<PlayerOpportunityAdminStats> {
  const supabase = await createClient();

  const playerSnapshotQuery = await supabase
    .from("player_opportunity_snapshots")
    .select("*", { count: "exact", head: true });

  if (playerSnapshotQuery.error) {
    if (isMissingPlayerOpportunityTableError(playerSnapshotQuery.error)) {
      return {
        usingDefaults: true,
        playerSnapshotCount: 0,
        cardSnapshotCount: 0,
        predictionCount: 0,
        latestPlayerComputedAt: null,
        latestCardComputedAt: null,
      };
    }
    return {
      usingDefaults: false,
      playerSnapshotCount: 0,
      cardSnapshotCount: 0,
      predictionCount: 0,
      latestPlayerComputedAt: null,
      latestCardComputedAt: null,
    };
  }

  const cardSnapshotQuery = await supabase
    .from("player_card_opportunity_snapshots")
    .select("*", { count: "exact", head: true });

  const predictionQuery = await supabase
    .from("player_opportunity_prediction_history")
    .select("*", { count: "exact", head: true });

  const latestPlayerQuery = await supabase
    .from("player_opportunity_snapshots")
    .select("computed_at")
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestCardQuery = await supabase
    .from("player_card_opportunity_snapshots")
    .select("computed_at")
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    usingDefaults: false,
    playerSnapshotCount: playerSnapshotQuery.count ?? 0,
    cardSnapshotCount: cardSnapshotQuery.error ? 0 : cardSnapshotQuery.count ?? 0,
    predictionCount: predictionQuery.error ? 0 : predictionQuery.count ?? 0,
    latestPlayerComputedAt: latestPlayerQuery.data?.computed_at ?? null,
    latestCardComputedAt: latestCardQuery.data?.computed_at ?? null,
  };
}
