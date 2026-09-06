import { buildCardInvestmentContextSync } from "@/lib/card-investment/build-card-context";
import { fetchSportMarketSnapshot } from "@/lib/card-investment/market/sport-market-client";
import { dm2CardToSyntheticAsset } from "@/lib/dm2-card-to-asset";
import { getMockMarketSales } from "@/lib/market-sales/mock-provider";
import { computePlayerCardOpportunity } from "@/lib/player-card-opportunity/player-card-opportunity-model";
import { buildPlayerOpportunityContextSync } from "@/lib/player-opportunity/build-player-context";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import type { SportMarketSnapshot } from "@/types/card-investment";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";
import type {
  OpportunityCatalyst,
  PlayerCardOpportunity,
  PlayerDemandSignals,
  PlayerOpportunity,
  PlayerProfileSignals,
  PlayerQualitySignals,
} from "@/types/player-opportunity";

export interface CatalogOpportunityResult {
  playerOpportunity: PlayerOpportunity;
  cardOpportunity: PlayerCardOpportunity;
}

export interface ComputeCatalogOpportunityOptions {
  qualitySignals?: PlayerQualitySignals;
  playerProfile?: PlayerProfileSignals;
  demandSignals?: PlayerDemandSignals;
  catalysts?: OpportunityCatalyst[];
}

export async function computeCatalogOpportunity(
  card: Dm2CardSearchResult,
  sportMarketOverride?: SportMarketSnapshot | null,
  playerSignals?: ComputeCatalogOpportunityOptions
): Promise<CatalogOpportunityResult> {
  const asset = dm2CardToSyntheticAsset(card);
  const sales = getMockMarketSales(asset).sales;
  const sportMarket =
    sportMarketOverride !== undefined
      ? sportMarketOverride
      : await fetchSportMarketSnapshot(asset.sport);

  const cardContext = buildCardInvestmentContextSync(asset, sales, {
    sportMarketOverride: sportMarket,
  });
  const playerContext = buildPlayerOpportunityContextSync(asset, {
    sportMarketOverride: sportMarket,
    qualitySignals: playerSignals?.qualitySignals,
    playerProfile: playerSignals?.playerProfile,
    demandSignals: playerSignals?.demandSignals,
    catalysts: playerSignals?.catalysts,
  });
  const playerOpportunity = computePlayerOpportunity(playerContext, cardContext);
  const cardOpportunity = computePlayerCardOpportunity({
    cardContext,
    playerContext,
    playerOpportunity,
  });

  return { playerOpportunity, cardOpportunity };
}
