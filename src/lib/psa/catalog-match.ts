import { POPULATION_AUTO_THRESHOLD } from "@/lib/card-population-lookup/match";
import { playerNameSimilarity } from "@/lib/dm2-player-match";
import type { PsaCertIdentity } from "@/lib/psa/types";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

export type CatalogMatchDecision = "auto" | "review" | "reject";

export interface CatalogMatchScore {
  card: Dm2CardSearchResult;
  decision: CatalogMatchDecision;
  confidence: number;
}

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
  return a.filter((token) => b.has(token)).length / a.length;
}

export function normalizeCardNumber(value: string): string {
  return value.trim().replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
}

export function cardNumberVariants(value: string): string[] {
  const trimmed = value.trim().replace(/^#+/, "");
  if (!trimmed) return [];
  const variants = new Set([trimmed, trimmed.toLowerCase(), trimmed.toUpperCase()]);
  const noLeadingZeros = trimmed.replace(/^0+(?=\d)/, "");
  if (noLeadingZeros) variants.add(noLeadingZeros);
  return [...variants];
}

function yearMatches(cardYear: number, psaYear: number | null): boolean {
  if (psaYear == null) return false;
  return cardYear === psaYear || cardYear === psaYear + 1 || cardYear === psaYear - 1;
}

function isBaseParallel(value: string | null | undefined): boolean {
  const normalized = normalizeTokenBlob(value ?? "");
  return !normalized || normalized === "base" || normalized === "base set";
}

export function scoreCatalogCardAgainstPsa(
  card: Dm2CardSearchResult,
  psa: PsaCertIdentity
): CatalogMatchScore {
  const year = yearMatches(card.year, psa.year);
  const cardNumber =
    normalizeCardNumber(card.cardNumber) === normalizeCardNumber(psa.cardNumber);
  const playerScore = Math.max(
    playerNameSimilarity(card.player, psa.subject),
    tokenOverlapScore(card.player, psa.subject)
  );
  const setHaystack = `${psa.brand} ${psa.variety}`;
  const setScore = Math.max(
    tokenOverlapScore(card.cardSetName, setHaystack),
    tokenOverlapScore(`${card.brandName} ${card.cardSetName}`, setHaystack)
  );
  const brandScore = Math.max(
    tokenOverlapScore(card.brandName, setHaystack),
    tokenOverlapScore(card.manufacturerName, setHaystack)
  );
  const catalogBase = isBaseParallel(card.parallelName);
  const candidateBase = isBaseParallel(psa.variety);
  const parallelScore = catalogBase
    ? candidateBase
      ? 1
      : tokenOverlapScore(card.parallelName ?? "", psa.variety)
    : tokenOverlapScore(card.parallelName ?? "", psa.variety);
  const parallelOk = parallelScore >= 0.8 || (catalogBase && candidateBase);

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

  const highIdentity =
    year && cardNumber && playerScore >= POPULATION_AUTO_THRESHOLD;
  const decision: CatalogMatchDecision =
    highIdentity && (setScore >= 0.5 || brandScore >= 0.5) && parallelOk
      ? "auto"
      : highIdentity || (cardNumber && playerScore >= 0.6 && year)
        ? "review"
        : "reject";

  return { card, decision, confidence };
}

export function pickCatalogMatchForPsaCert(
  cards: Dm2CardSearchResult[],
  psa: PsaCertIdentity
): {
  status: "auto" | "review" | "none";
  cards: Dm2CardSearchResult[];
} {
  const scored = cards
    .map((card) => scoreCatalogCardAgainstPsa(card, psa))
    .filter((row) => row.decision !== "reject")
    .sort((a, b) => b.confidence - a.confidence || a.card.id.localeCompare(b.card.id));

  if (scored.length === 0) {
    return { status: "none", cards: [] };
  }

  const autos = scored.filter((row) => row.decision === "auto");
  if (autos.length === 1) {
    const best = autos[0]!;
    const rival = scored.find((row) => row.card.id !== best.card.id);
    if (!rival || best.confidence - rival.confidence >= 0.05) {
      return { status: "auto", cards: [best.card] };
    }
  }

  return {
    status: "review",
    cards: scored.slice(0, 8).map((row) => row.card),
  };
}
