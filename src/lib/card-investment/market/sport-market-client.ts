import { getSportMarketIndex } from "@/app/actions/market-index";
import { getLatestSportMarketIndexSnapshot } from "@/lib/market-index-cache";
import { resolveSportMarketIndexId } from "@/lib/market-index/resolve-sport-index-id";
import {
  availableProvenance,
  unavailableProvenance,
} from "@/lib/card-investment/provenance/types";
import type { SportMarketSnapshot } from "@/types/card-investment";
import type { SportMarketIndexResult } from "@/types/market-index";

function mapIndexResult(
  result: SportMarketIndexResult,
  source: string
): SportMarketSnapshot {
  return {
    sportId: result.sportId,
    healthScore: result.healthScore,
    momentumScore: result.momentumScore,
    outlookScore: result.outlookScore,
    forecast3mPct: result.forecast3mPct,
    confidenceScore: result.confidenceScore,
    riskRating: result.riskRating,
    seasonPhase: result.seasonPhase,
    asOf: result.asOf,
    provenance: availableProvenance(source, result.asOf),
  };
}

export async function fetchSportMarketSnapshot(
  sportLabel: string
): Promise<SportMarketSnapshot | null> {
  const sportId = resolveSportMarketIndexId(sportLabel);
  if (!sportId) return null;

  const response = await getSportMarketIndex(sportId);
  if (response.result) {
    const source = response.fromCache
      ? "sport-market-index-cache"
      : "sport-market-index-snapshot";
    return mapIndexResult(response.result, source);
  }

  const snapshot = await getLatestSportMarketIndexSnapshot(sportId);
  if (snapshot) {
    return mapIndexResult(snapshot.result, "sport-market-index-snapshot");
  }

  return null;
}

export function sportMarketSnapshotFromResult(
  result: SportMarketIndexResult | null,
  source = "sport-market-index"
): SportMarketSnapshot | null {
  if (!result) return null;
  return mapIndexResult(result, source);
}

export function unavailableSportMarketSnapshot(
  sportLabel: string
): SportMarketSnapshot {
  const sportId = resolveSportMarketIndexId(sportLabel) ?? "unknown";
  return {
    sportId,
    healthScore: 0,
    momentumScore: 0,
    outlookScore: 0,
    forecast3mPct: 0,
    confidenceScore: 0,
    riskRating: "high",
    seasonPhase: "unknown",
    asOf: new Date(0).toISOString(),
    provenance: unavailableProvenance(
      "sport-market-index",
      `No index data for ${sportLabel}`
    ),
  };
}
