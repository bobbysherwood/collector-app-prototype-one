import { scorePopulationCandidate } from "@/lib/card-population-lookup/match";
import {
  applyPlayerPrefixVariety,
  parsePsaPopulationJson,
} from "@/lib/card-population-lookup/parse-psa-json";
import type {
  CatalogCardIdentity,
  GraderPopCandidate,
  PopulationMatchDecision,
} from "@/lib/card-population-lookup/types";
import type { CardPopulationCounts } from "@/lib/dm2-card-population";
import { applyPopulationPatch, emptyPopulationCounts } from "@/lib/dm2-card-population";

export interface PsaIngestProposal {
  decision: PopulationMatchDecision;
  confidence: number;
  reasons: string[];
  cardId: string | null;
  cardLabel: string;
  candidate: GraderPopCandidate;
  psaCounts: Partial<CardPopulationCounts>;
}

export interface PsaIngestResult {
  headingId: number | null;
  candidates: number;
  auto: PsaIngestProposal[];
  review: PsaIngestProposal[];
  reject: PsaIngestProposal[];
}

function psaCountsFromCandidate(
  candidate: GraderPopCandidate
): Partial<CardPopulationCounts> {
  const counts: Partial<CardPopulationCounts> = {};
  for (let grade = 1; grade <= 10; grade += 1) {
    const key = `psa_${grade}`;
    const value = candidate.counts[key];
    if (typeof value === "number") counts[key] = value;
  }
  return counts;
}

function refineAgainstPlayers(
  candidate: GraderPopCandidate,
  players: string[]
): GraderPopCandidate {
  for (const player of players) {
    const next = applyPlayerPrefixVariety(candidate, player);
    if (next.variety !== candidate.variety || next.subject !== candidate.subject) {
      return next;
    }
  }
  return candidate;
}

function cardLabel(card: CatalogCardIdentity): string {
  return `${card.year} ${card.cardSetName} #${card.cardNumber} ${card.player}${
    card.parallelName ? ` (${card.parallelName})` : ""
  }`;
}

export function planPsaPopulationIngest(input: {
  json: unknown;
  setName: string;
  headingId?: number | null;
  cards: CatalogCardIdentity[];
}): PsaIngestResult {
  const players = [...new Set(input.cards.map((card) => card.player).filter(Boolean))];
  const candidates = parsePsaPopulationJson(input.json, input.setName).map((candidate) =>
    refineAgainstPlayers(candidate, players)
  );

  const auto: PsaIngestProposal[] = [];
  const review: PsaIngestProposal[] = [];
  const reject: PsaIngestProposal[] = [];

  for (const candidate of candidates) {
    const scored = input.cards
      .map((card) => ({ card, result: scorePopulationCandidate(card, candidate) }))
      .sort((a, b) => b.result.confidence - a.result.confidence)[0];

    const proposal: PsaIngestProposal = {
      decision: scored?.result.decision ?? "reject",
      confidence: scored?.result.confidence ?? 0,
      reasons: scored?.result.reasons ?? [],
      cardId: scored?.card.id ?? null,
      cardLabel: scored ? cardLabel(scored.card) : `${candidate.subject} #${candidate.cardNumber}`,
      candidate,
      psaCounts: psaCountsFromCandidate(candidate),
    };

    if (proposal.decision === "auto" && proposal.cardId) auto.push(proposal);
    else if (proposal.decision === "review") review.push(proposal);
    else reject.push(proposal);
  }

  return {
    headingId: input.headingId ?? null,
    candidates: candidates.length,
    auto,
    review,
    reject,
  };
}

export function mergePsaCounts(
  existing: CardPopulationCounts | null,
  psaCounts: Partial<CardPopulationCounts>
): CardPopulationCounts {
  return applyPopulationPatch(existing ?? emptyPopulationCounts(), psaCounts);
}
