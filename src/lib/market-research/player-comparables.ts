import type { PlayerLiveStatsSnapshot } from "@/lib/player-stats/types";
import type { PlayerCareerStatus, PlayerOpportunity } from "@/types/player-opportunity";

export const COMPARABLE_CANDIDATE_LIMIT = 30;
export const COMPARABLE_RESULT_LIMIT = 8;
export const COMPARABLE_BIRTH_YEAR_WINDOW = 3;
export const COMPARABLE_DRAFT_YEAR_WINDOW = 2;
export const COMPARABLE_OPPORTUNITY_WINDOW = 12;

export interface ComparableProfile {
  playerId?: string | null;
  playerName: string;
  sport: string;
  birthYear?: number | null;
  careerStatus?: PlayerCareerStatus | null;
  team?: string | null;
  draftYear?: number | null;
  opportunityScore?: number | null;
  cardCount?: number;
}

export interface ComparableMatchReason {
  key: string;
  label: string;
}

export interface ComparableScore {
  matchScore: number;
  reasons: ComparableMatchReason[];
}

export interface PlayerComparablePreview {
  playerId: string;
  playerName: string;
  sportLabel: string;
  imageUrl: string | null;
  href: string;
  matchScore: number;
  reasons: ComparableMatchReason[];
  cardCount: number;
}

export function normalizeComparableText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function sameComparableSport(left: string, right: string): boolean {
  return normalizeComparableText(left) === normalizeComparableText(right);
}

export function teamsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  const a = normalizeComparableText(left.replace(/^the\s+/i, ""));
  const b = normalizeComparableText(right.replace(/^the\s+/i, ""));
  if (!a || !b) return false;
  if (a === b) return true;

  const lastA = a.split(" ").at(-1) ?? "";
  const lastB = b.split(" ").at(-1) ?? "";
  return lastA.length >= 4 && lastA === lastB;
}

export function estimatedDraftYear(profile: Pick<ComparableProfile, "draftYear" | "birthYear">): number | null {
  if (profile.draftYear != null) return profile.draftYear;
  if (profile.birthYear != null) return profile.birthYear + 22;
  return null;
}

export function buildSubjectComparableProfile(input: {
  playerId?: string | null;
  playerName: string;
  sportLabel: string;
  liveStats?: PlayerLiveStatsSnapshot | null;
  playerOpportunity?: PlayerOpportunity | null;
  catalogProfile?: {
    birthYear?: number | null;
    careerStatus?: PlayerCareerStatus | null;
    team?: string | null;
  } | null;
}): ComparableProfile {
  const live = input.liveStats;
  const catalog = input.catalogProfile;
  return {
    playerId: input.playerId ?? null,
    playerName: input.playerName,
    sport: input.sportLabel,
    birthYear:
      live?.playerProfile.birthYear ??
      live?.bio.birthYear ??
      catalog?.birthYear ??
      null,
    careerStatus:
      live?.playerProfile.careerStatus ??
      catalog?.careerStatus ??
      input.playerOpportunity?.lifecycle ??
      null,
    team: live?.playerProfile.team ?? live?.bio.team ?? catalog?.team ?? null,
    draftYear: live?.bio.draftYear ?? null,
    opportunityScore: input.playerOpportunity?.opportunityScore ?? null,
  };
}

export function scorePlayerComparable(
  subject: ComparableProfile,
  candidate: ComparableProfile
): ComparableScore | null {
  if (!sameComparableSport(subject.sport, candidate.sport)) return null;

  const subjectName = normalizeComparableText(subject.playerName);
  const candidateName = normalizeComparableText(candidate.playerName);
  if (
    (subject.playerId && candidate.playerId && subject.playerId === candidate.playerId) ||
    (subjectName && candidateName && subjectName === candidateName)
  ) {
    return null;
  }

  let matchScore = 40;
  const reasons: ComparableMatchReason[] = [];

  if (subject.careerStatus && candidate.careerStatus) {
    if (subject.careerStatus === candidate.careerStatus) {
      matchScore += 20;
      reasons.push({ key: "career", label: "Same career stage" });
    }
  } else {
    matchScore += 6;
  }

  if (subject.birthYear != null && candidate.birthYear != null) {
    const diff = Math.abs(subject.birthYear - candidate.birthYear);
    if (diff <= COMPARABLE_BIRTH_YEAR_WINDOW) {
      matchScore += 20;
      reasons.push({ key: "birth-year", label: "Born within 3 years" });
    } else if (diff <= 5) {
      matchScore += 8;
    }
  } else {
    matchScore += 4;
  }

  if (teamsMatch(subject.team, candidate.team)) {
    matchScore += 12;
    reasons.push({ key: "team", label: "Same team" });
  }

  const subjectDraft = estimatedDraftYear(subject);
  const candidateDraft = estimatedDraftYear(candidate);
  if (subjectDraft != null && candidateDraft != null) {
    if (Math.abs(subjectDraft - candidateDraft) <= COMPARABLE_DRAFT_YEAR_WINDOW) {
      matchScore += 10;
      reasons.push({ key: "draft", label: "Same draft window" });
    }
  }

  if (subject.opportunityScore != null && candidate.opportunityScore != null) {
    const diff = Math.abs(subject.opportunityScore - candidate.opportunityScore);
    if (diff <= COMPARABLE_OPPORTUNITY_WINDOW) {
      matchScore += 15;
      reasons.push({ key: "opportunity", label: "Nearby opportunity" });
    } else if (diff <= 20) {
      matchScore += 8;
    }
  }

  if (reasons.length === 0) {
    reasons.push({ key: "sport", label: "Same sport" });
  }

  return {
    matchScore: Math.max(0, Math.min(100, matchScore)),
    reasons,
  };
}

export function rankPlayerComparables(
  subject: ComparableProfile,
  candidates: ComparableProfile[],
  limit = COMPARABLE_RESULT_LIMIT
): Array<ComparableProfile & ComparableScore> {
  return candidates
    .flatMap((candidate) => {
      const scored = scorePlayerComparable(subject, candidate);
      return scored ? [{ ...candidate, ...scored }] : [];
    })
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;
      const cardDelta = (right.cardCount ?? 0) - (left.cardCount ?? 0);
      if (cardDelta !== 0) return cardDelta;
      return left.playerName.localeCompare(right.playerName);
    })
    .slice(0, limit);
}
