import type { CardValuation } from "@/types/card";

export function buildLatestValuationMap(
  valuations: CardValuation[]
): Map<string, CardValuation> {
  const map = new Map<string, CardValuation>();

  for (const valuation of valuations) {
    const existing = map.get(valuation.lot_id);
    if (
      !existing ||
      new Date(valuation.recorded_at).getTime() >
        new Date(existing.recorded_at).getTime()
    ) {
      map.set(valuation.lot_id, valuation);
    }
  }

  return map;
}

export function groupValuationsByLot(
  valuations: CardValuation[]
): Map<string, CardValuation[]> {
  const map = new Map<string, CardValuation[]>();

  for (const valuation of valuations) {
    const list = map.get(valuation.lot_id) ?? [];
    list.push(valuation);
    map.set(valuation.lot_id, list);
  }

  for (const [lotId, list] of map) {
    map.set(
      lotId,
      [...list].sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      )
    );
  }

  return map;
}

/** @deprecated Use groupValuationsByLot */
export const groupValuationsByAsset = groupValuationsByLot;
