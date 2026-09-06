import { classifyPlayerLifecycle } from "@/lib/card-investment/classification/player-lifecycle";
import { fetchSportMarketSnapshot } from "@/lib/card-investment/market/sport-market-client";
import { getAsset } from "@/lib/data";
import {
  buildPlayerId,
  classifyPlayerOpportunityLifecycle,
} from "@/lib/player-opportunity/classification/lifecycle";
import type { Asset } from "@/types/asset";
import type { SportMarketSnapshot } from "@/types/card-investment";
import type {
  OpportunityCatalyst,
  PlayerDemandSignals,
  PlayerOpportunityContext,
  PlayerProfileSignals,
  PlayerQualitySignals,
} from "@/types/player-opportunity";

export interface BuildPlayerContextOptions {
  asOf?: string;
  sportMarketOverride?: SportMarketSnapshot | null;
  qualitySignals?: PlayerQualitySignals;
  demandSignals?: PlayerDemandSignals;
  playerProfile?: PlayerProfileSignals;
  catalysts?: OpportunityCatalyst[];
}

function emptyQualitySignals(notes: string[]): PlayerQualitySignals {
  return {
    careerStrength: null,
    legacyStrength: null,
    culturalRelevance: null,
    injuryRisk: null,
    availableFieldCount: 0,
    provenanceNotes: notes,
  };
}

function defaultQualitySignals(asset: Asset): PlayerQualitySignals {
  const player = asset.player_name.toLowerCase();
  const hasLegacyName = ["jordan", "lebron", "kobe", "magic", "bird"].some((n) =>
    player.includes(n)
  );
  if (hasLegacyName) {
    return {
      careerStrength: 85,
      legacyStrength: 90,
      culturalRelevance: 88,
      injuryRisk: null,
      availableFieldCount: 3,
      provenanceNotes: ["Legacy tier inferred from player name heuristics"],
    };
  }
  return emptyQualitySignals(["No live player-stats signals available"]);
}

function lifecycleFromIdentity(
  profile: PlayerProfileSignals | undefined,
  asOfYear: number
): PlayerOpportunityContext["lifecycle"] {
  if (profile?.careerStatus) return profile.careerStatus;
  if (profile?.birthYear != null && asOfYear - profile.birthYear <= 21) {
    return "prospect";
  }
  return "active";
}

function defaultDemandSignals(): PlayerDemandSignals {
  return {
    attentionScore: null,
    sentimentScore: null,
    searchInterestScore: null,
    discussionGrowthScore: null,
    sourceCount: 0,
    provenanceNotes: ["Public sentiment sources not connected in V1"],
  };
}

export async function buildPlayerOpportunityContext(
  asset: Asset,
  options: BuildPlayerContextOptions = {}
): Promise<PlayerOpportunityContext> {
  const asOf = options.asOf ?? new Date().toISOString();
  const asOfYear = new Date(asOf).getFullYear();
  const cardLifecycle = classifyPlayerLifecycle(asset, asOfYear);
  const lifecycle = classifyPlayerOpportunityLifecycle(
    asset,
    cardLifecycle,
    asOfYear,
    options.playerProfile
  );

  const sportMarket =
    options.sportMarketOverride !== undefined
      ? options.sportMarketOverride
      : await fetchSportMarketSnapshot(asset.sport);

  return {
    playerId: buildPlayerId(asset.player_name, asset.sport),
    playerName: asset.player_name,
    sport: asset.sport,
    lifecycle,
    asOf,
    cardYear: asset.year,
    playerProfile: options.playerProfile,
    sportMarket,
    qualitySignals: options.qualitySignals ?? defaultQualitySignals(asset),
    demandSignals: options.demandSignals ?? defaultDemandSignals(),
    catalysts: options.catalysts,
  };
}

export async function buildPlayerOpportunityContextByAssetId(
  assetId: string,
  options: BuildPlayerContextOptions = {}
): Promise<PlayerOpportunityContext | null> {
  const asset = await getAsset(assetId);
  if (!asset) return null;
  return buildPlayerOpportunityContext(asset, options);
}

export function buildPlayerOpportunityContextFromIdentity(input: {
  playerName: string;
  sport: string;
  asOf?: string;
  playerProfile?: PlayerProfileSignals;
  qualitySignals?: PlayerQualitySignals;
  demandSignals?: PlayerDemandSignals;
  catalysts?: OpportunityCatalyst[];
  sportMarket?: SportMarketSnapshot | null;
}): PlayerOpportunityContext {
  const asOf = input.asOf ?? new Date().toISOString();
  const asOfYear = new Date(asOf).getFullYear();
  return {
    playerId: buildPlayerId(input.playerName, input.sport),
    playerName: input.playerName,
    sport: input.sport,
    lifecycle: lifecycleFromIdentity(input.playerProfile, asOfYear),
    asOf,
    playerProfile: input.playerProfile,
    sportMarket: input.sportMarket ?? null,
    qualitySignals:
      input.qualitySignals ??
      emptyQualitySignals(["No live player-stats signals available"]),
    demandSignals: input.demandSignals ?? defaultDemandSignals(),
    catalysts: input.catalysts,
  };
}

export function buildPlayerOpportunityContextSync(
  asset: Asset,
  options: BuildPlayerContextOptions = {}
): PlayerOpportunityContext {
  const asOf = options.asOf ?? new Date().toISOString();
  const asOfYear = new Date(asOf).getFullYear();
  const cardLifecycle = classifyPlayerLifecycle(asset, asOfYear);
  const lifecycle = classifyPlayerOpportunityLifecycle(
    asset,
    cardLifecycle,
    asOfYear,
    options.playerProfile
  );

  return {
    playerId: buildPlayerId(asset.player_name, asset.sport),
    playerName: asset.player_name,
    sport: asset.sport,
    lifecycle,
    asOf,
    cardYear: asset.year,
    playerProfile: options.playerProfile,
    sportMarket: options.sportMarketOverride ?? null,
    qualitySignals: options.qualitySignals ?? defaultQualitySignals(asset),
    demandSignals: options.demandSignals ?? defaultDemandSignals(),
    catalysts: options.catalysts,
  };
}
