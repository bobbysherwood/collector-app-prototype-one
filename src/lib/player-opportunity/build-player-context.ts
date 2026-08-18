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
  PlayerDemandSignals,
  PlayerOpportunityContext,
  PlayerQualitySignals,
} from "@/types/player-opportunity";

export interface BuildPlayerContextOptions {
  asOf?: string;
  sportMarketOverride?: SportMarketSnapshot | null;
  qualitySignals?: PlayerQualitySignals;
  demandSignals?: PlayerDemandSignals;
}

function defaultQualitySignals(asset: Asset): PlayerQualitySignals {
  const player = asset.player_name.toLowerCase();
  const hasLegacyName = ["jordan", "lebron", "kobe", "magic", "bird"].some((n) =>
    player.includes(n)
  );
  return {
    careerStrength: hasLegacyName ? 85 : null,
    legacyStrength: hasLegacyName ? 90 : null,
    culturalRelevance: hasLegacyName ? 88 : null,
    injuryRisk: null,
    availableFieldCount: hasLegacyName ? 3 : 0,
    provenanceNotes: hasLegacyName
      ? ["Legacy tier inferred from player name heuristics"]
      : ["No external player stats connected in V1"],
  };
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
  const cardLifecycle = classifyPlayerLifecycle(asset);
  const lifecycle = classifyPlayerOpportunityLifecycle(asset, cardLifecycle);

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
    sportMarket,
    qualitySignals: options.qualitySignals ?? defaultQualitySignals(asset),
    demandSignals: options.demandSignals ?? defaultDemandSignals(),
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

export function buildPlayerOpportunityContextSync(
  asset: Asset,
  options: BuildPlayerContextOptions = {}
): PlayerOpportunityContext {
  const asOf = options.asOf ?? new Date().toISOString();
  const cardLifecycle = classifyPlayerLifecycle(asset);
  const lifecycle = classifyPlayerOpportunityLifecycle(asset, cardLifecycle);

  return {
    playerId: buildPlayerId(asset.player_name, asset.sport),
    playerName: asset.player_name,
    sport: asset.sport,
    lifecycle,
    asOf,
    sportMarket: options.sportMarketOverride ?? null,
    qualitySignals: options.qualitySignals ?? defaultQualitySignals(asset),
    demandSignals: options.demandSignals ?? defaultDemandSignals(),
  };
}
