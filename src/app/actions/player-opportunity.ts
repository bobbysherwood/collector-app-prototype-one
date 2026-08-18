"use server";

import { buildCardInvestmentContextById } from "@/lib/card-investment/build-card-context";
import { buildPlayerOpportunityContext } from "@/lib/player-opportunity/build-player-context";
import {
  persistPlayerCardOpportunity,
  persistPlayerOpportunity,
} from "@/lib/player-opportunity/data/player-opportunity-data";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import { computePlayerCardOpportunity } from "@/lib/player-card-opportunity/player-card-opportunity-model";
import { getAsset, getUserProfile } from "@/lib/data";
import type { PlayerCardOpportunity, PlayerOpportunity } from "@/types/player-opportunity";

export interface PlayerOpportunityResponse {
  error?: string;
  opportunity?: PlayerOpportunity;
}

export interface PlayerCardOpportunityResponse {
  error?: string;
  playerOpportunity?: PlayerOpportunity;
  cardOpportunity?: PlayerCardOpportunity;
}

export async function getPlayerOpportunityForCard(
  cardId: string,
  options: { persist?: boolean } = {}
): Promise<PlayerOpportunityResponse> {
  const user = await getUserProfile();
  if (!user) return { error: "You must be signed in." };

  const asset = await getAsset(cardId);
  if (!asset) return { error: "Card not found." };

  const cardContext = await buildCardInvestmentContextById(cardId);
  if (!cardContext) return { error: "Card not found." };

  const playerContext = await buildPlayerOpportunityContext(asset, {
    asOf: cardContext.asOf,
    sportMarketOverride: cardContext.sportMarket,
  });

  const opportunity = computePlayerOpportunity(playerContext, cardContext);

  if (options.persist !== false) {
    await persistPlayerOpportunity(opportunity, cardId);
  }

  return { opportunity };
}

export async function getPlayerCardOpportunity(
  cardId: string,
  options: { persist?: boolean } = {}
): Promise<PlayerCardOpportunityResponse> {
  const user = await getUserProfile();
  if (!user) return { error: "You must be signed in." };

  const cardContext = await buildCardInvestmentContextById(cardId);
  if (!cardContext) return { error: "Card not found." };

  const playerContext = await buildPlayerOpportunityContext(cardContext.asset, {
    asOf: cardContext.asOf,
    sportMarketOverride: cardContext.sportMarket,
  });

  const playerOpportunity = computePlayerOpportunity(playerContext, cardContext);
  const cardOpportunity = computePlayerCardOpportunity({
    cardContext,
    playerContext,
    playerOpportunity,
  });

  if (options.persist !== false) {
    await persistPlayerOpportunity(playerOpportunity, cardId);
    await persistPlayerCardOpportunity(cardOpportunity);
  }

  return { playerOpportunity, cardOpportunity };
}
