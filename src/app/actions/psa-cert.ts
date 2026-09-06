"use server";

import { searchDm2Players } from "@/app/actions/data-model-v2";
import { dm2CardToFormPrefill } from "@/lib/dm2-card-to-asset";
import { sameHoldingsSport } from "@/lib/holdings-player";
import { normalizePlayerNameKey } from "@/lib/dm2-player-match";
import { pickCatalogMatchForPsaCert } from "@/lib/psa/catalog-match";
import { fetchPsaCertByNumber } from "@/lib/psa/cert-lookup";
import { findCatalogCardsForPsaCert } from "@/lib/psa/find-catalog-cards";
import { psaCertIdentity, psaCertToFormPrefill } from "@/lib/psa/map-cert";
import { createClient } from "@/lib/supabase/server";
import type { CardFormData, Sport } from "@/types/card";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";
import type { NormalizedPsaCert } from "@/lib/psa/types";

export interface PsaCertSummary {
  certNumber: string;
  subject: string;
  year: number | null;
  cardNumber: string;
  category: string;
  brand: string;
  variety: string;
  grade: string;
  gradeDescription: string;
  sport: Sport;
}

export interface LookupPsaCertSuccess {
  cert: PsaCertSummary;
  formPrefill: Partial<CardFormData>;
  catalogMatch: {
    status: "auto" | "review" | "none";
    cards: Dm2CardSearchResult[];
  };
}

export type LookupPsaCertResult =
  | { error: string }
  | LookupPsaCertSuccess;

function toSummary(cert: NormalizedPsaCert): PsaCertSummary {
  return {
    certNumber: cert.certNumber,
    subject: cert.subject,
    year: cert.year,
    cardNumber: cert.cardNumber,
    category: cert.category,
    brand: cert.brand,
    variety: cert.variety,
    grade: cert.grade,
    gradeDescription: cert.gradeDescription,
    sport: cert.sport,
  };
}

async function resolveCatalogPlayerId(
  subject: string,
  sport: Sport
): Promise<string | null> {
  const result = await searchDm2Players(subject);
  const players = result.players ?? [];
  const exact = players.filter(
    (player) =>
      normalizePlayerNameKey(player.player) === normalizePlayerNameKey(subject) &&
      (sport === "Other" || sameHoldingsSport(player.sport, sport))
  );
  if (exact.length === 1) return exact[0]!.id;
  if (sport === "Other") {
    const byName = players.filter(
      (player) =>
        normalizePlayerNameKey(player.player) === normalizePlayerNameKey(subject)
    );
    if (byName.length === 1) return byName[0]!.id;
  }
  return null;
}

export async function lookupPsaCert(certNumber: string): Promise<LookupPsaCertResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to look up a PSA cert." };
  }

  const lookup = await fetchPsaCertByNumber(certNumber);
  if (lookup.status !== "found") {
    return { error: lookup.message };
  }

  const cert = lookup.cert;
  const playerId = await resolveCatalogPlayerId(cert.subject, cert.sport);
  let formPrefill = {
    ...psaCertToFormPrefill(cert),
    player_id: playerId,
  };

  const found = await findCatalogCardsForPsaCert({
    year: cert.year,
    cardNumber: cert.cardNumber,
  });
  if (found.error) {
    return {
      cert: toSummary(cert),
      formPrefill,
      catalogMatch: { status: "none", cards: [] },
    };
  }

  const catalogMatch = pickCatalogMatchForPsaCert(
    found.cards ?? [],
    psaCertIdentity(cert)
  );

  if (catalogMatch.status === "auto" && catalogMatch.cards[0]) {
    const card = catalogMatch.cards[0];
    formPrefill = {
      ...dm2CardToFormPrefill(card),
      player_id: playerId,
      grader: "PSA",
      grade: cert.grade,
      cert_number: cert.certNumber,
    };
  }

  return {
    cert: toSummary(cert),
    formPrefill,
    catalogMatch,
  };
}
