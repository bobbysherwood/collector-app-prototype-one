import {
  levenshteinDistance,
  normalizePlayerNameKey,
  playerNameSimilarity,
} from "@/lib/dm2-player-match";
import type {
  CatalogCardIdentity,
  GraderPopCandidate,
  PopulationMatchResult,
} from "@/lib/card-population-lookup/types";

/** Same bar the AI Loader uses to auto-map an existing catalog value. */
export const POPULATION_AUTO_THRESHOLD = 0.95;

function normalizeTokenBlob(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function significantTokens(value: string): string[] {
  return normalizeTokenBlob(value)
    .split(" ")
    .filter((token) => token.length > 2 && token !== "the");
}

function tokenOverlapScore(left: string, right: string): number {
  const a = significantTokens(left);
  const b = new Set(significantTokens(right));
  if (a.length === 0 || b.size === 0) return 0;
  const matched = a.filter((token) => b.has(token)).length;
  return matched / a.length;
}

function normalizeCardNumber(value: string): string {
  return value.trim().replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
}

function yearMatches(card: CatalogCardIdentity, candidate: GraderPopCandidate): boolean {
  if (candidate.year == null) {
    return String(card.year) === (candidate.setName.match(/\b(19|20)\d{2}\b/)?.[0] ?? "");
  }
  return candidate.year === card.year || candidate.year === card.year + 1;
}

function isBaseParallel(value: string | null | undefined): boolean {
  const normalized = normalizeTokenBlob(value ?? "");
  return !normalized || normalized === "base" || normalized === "base set";
}

export function scorePopulationCandidate(
  card: CatalogCardIdentity,
  candidate: GraderPopCandidate
): PopulationMatchResult {
  const year = yearMatches(card, candidate);
  const cardNumber =
    normalizeCardNumber(card.cardNumber) === normalizeCardNumber(candidate.cardNumber);
  const playerScore = Math.max(
    playerNameSimilarity(card.player, candidate.subject),
    tokenOverlapScore(card.player, candidate.subject)
  );
  const setHaystack = `${candidate.setName} ${candidate.variety}`;
  const setScore = Math.max(
    tokenOverlapScore(card.cardSetName, setHaystack),
    tokenOverlapScore(`${card.brandName} ${card.cardSetName}`, setHaystack)
  );
  const brandScore = tokenOverlapScore(card.brandName, setHaystack);
  const catalogBase = isBaseParallel(card.parallelName);
  const candidateBase = isBaseParallel(candidate.variety);
  const parallelScore = catalogBase
    ? candidateBase
      ? 1
      : 0
    : tokenOverlapScore(card.parallelName ?? "", candidate.variety);
  const parallelOk = parallelScore >= 0.8;

  const reasons: string[] = [];
  if (year) reasons.push("year");
  if (cardNumber) reasons.push("card number");
  if (playerScore >= POPULATION_AUTO_THRESHOLD) reasons.push("player");
  else if (playerScore >= 0.6) reasons.push("player fuzzy");
  if (setScore >= 0.5) reasons.push("set");
  if (brandScore >= 0.5) reasons.push("brand");
  if (parallelOk) reasons.push(catalogBase ? "base variety" : "parallel");

  const confidence = Number(
    (
      (year ? 0.2 : 0) +
      (cardNumber ? 0.25 : 0) +
      playerScore * 0.25 +
      setScore * 0.15 +
      brandScore * 0.05 +
      (parallelOk ? 0.1 : 0)
    ).toFixed(3)
  );

  const highIdentity = year && cardNumber && playerScore >= POPULATION_AUTO_THRESHOLD;
  const decision =
    highIdentity && (setScore >= 0.5 || brandScore >= 0.5) && parallelOk
      ? "auto"
      : highIdentity || (cardNumber && playerScore >= 0.6 && year)
        ? "review"
        : "reject";

  return {
    decision,
    confidence,
    reasons,
    breakdown: { year, cardNumber, playerScore, setScore, brandScore, parallelOk },
    candidate,
  };
}

export function pickBestPopulationMatch(
  card: CatalogCardIdentity,
  candidates: GraderPopCandidate[]
): PopulationMatchResult | null {
  const scored = candidates
    .map((candidate) => scorePopulationCandidate(card, candidate))
    .sort((a, b) => b.confidence - a.confidence);
  return scored[0] ?? null;
}

export function fuzzyEntityScore(left: string, right: string): number {
  const a = normalizePlayerNameKey(left);
  const b = normalizePlayerNameKey(right);
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 0;
  return Math.max(0, 1 - levenshteinDistance(a, b) / max);
}
