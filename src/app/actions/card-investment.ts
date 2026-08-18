"use server";

import {
  buildCardInvestmentContextById,
} from "@/lib/card-investment/build-card-context";
import { persistCardInvestmentProfile } from "@/lib/card-investment/data/card-investment-data";
import { computeInvestmentProfile } from "@/lib/card-investment/orchestrator/compute-investment-profile";
import { getUserProfile } from "@/lib/data";
import type { CardInvestmentProfile } from "@/types/card-investment";

export interface CardInvestmentProfileResponse {
  error?: string;
  profile?: CardInvestmentProfile;
}

export async function getCardInvestmentProfile(
  cardId: string,
  options: { persist?: boolean } = {}
): Promise<CardInvestmentProfileResponse> {
  const user = await getUserProfile();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const context = await buildCardInvestmentContextById(cardId);
  if (!context) {
    return { error: "Card not found." };
  }

  const profile = computeInvestmentProfile(context);

  if (options.persist !== false) {
    await persistCardInvestmentProfile(profile);
  }

  return { profile };
}
