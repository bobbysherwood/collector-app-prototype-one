"use server";

import {
  getCardInvestmentAdminStats,
  getPlayerOpportunityAdminStats,
} from "@/lib/ai-models-admin-data";
import { listCardInvestmentWeightProfiles } from "@/lib/card-investment/weights/profiles";
import {
  DEFAULT_OPPORTUNITY_THRESHOLDS,
  listPlayerCardOpportunityWeightProfiles,
  listPlayerOpportunityWeightProfiles,
} from "@/lib/player-opportunity/weights/profiles";
import type { ModelWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  OpportunityThresholds,
  PlayerCardOpportunityWeightProfile,
  PlayerOpportunityWeightProfile,
} from "@/types/player-opportunity";
import { CARD_INVESTMENT_MODEL_VERSION } from "@/types/card-investment";
import {
  PLAYER_CARD_OPPORTUNITY_MODEL_VERSION,
  PLAYER_OPPORTUNITY_MODEL_VERSION,
} from "@/types/player-opportunity";

export interface CardInvestmentAdminMeta {
  stats: Awaited<ReturnType<typeof getCardInvestmentAdminStats>>;
  modelVersion: string;
  weightProfiles: ModelWeightProfile[];
  apiRoute: string;
}

export interface PlayerOpportunityAdminMeta {
  stats: Awaited<ReturnType<typeof getPlayerOpportunityAdminStats>>;
  playerModelVersion: string;
  cardModelVersion: string;
  playerWeightProfiles: PlayerOpportunityWeightProfile[];
  cardWeightProfiles: PlayerCardOpportunityWeightProfile[];
  thresholds: OpportunityThresholds;
  apiRoutes: {
    player: string;
    playerCard: string;
  };
}

export async function getCardInvestmentAdminMeta(): Promise<CardInvestmentAdminMeta> {
  const stats = await getCardInvestmentAdminStats();
  return {
    stats,
    modelVersion: CARD_INVESTMENT_MODEL_VERSION,
    weightProfiles: listCardInvestmentWeightProfiles(),
    apiRoute: "/api/cards/[cardId]/investment-profile",
  };
}

export async function getPlayerOpportunityAdminMeta(): Promise<PlayerOpportunityAdminMeta> {
  const stats = await getPlayerOpportunityAdminStats();
  return {
    stats,
    playerModelVersion: PLAYER_OPPORTUNITY_MODEL_VERSION,
    cardModelVersion: PLAYER_CARD_OPPORTUNITY_MODEL_VERSION,
    playerWeightProfiles: listPlayerOpportunityWeightProfiles(),
    cardWeightProfiles: listPlayerCardOpportunityWeightProfiles(),
    thresholds: DEFAULT_OPPORTUNITY_THRESHOLDS,
    apiRoutes: {
      player: "/api/cards/[cardId]/player-opportunity",
      playerCard: "/api/cards/[cardId]/player-card-opportunity",
    },
  };
}
