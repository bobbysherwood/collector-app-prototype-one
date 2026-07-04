import type { CardValuation } from "@/types/card";

export function buildLatestValuationMap(
  valuations: CardValuation[]
): Map<string, CardValuation> {
  const map = new Map<string, CardValuation>();

  for (const valuation of valuations) {
    const existing = map.get(valuation.card_id);
    if (
      !existing ||
      new Date(valuation.recorded_at).getTime() >
        new Date(existing.recorded_at).getTime()
    ) {
      map.set(valuation.card_id, valuation);
    }
  }

  return map;
}

export function groupValuationsByCard(
  valuations: CardValuation[]
): Map<string, CardValuation[]> {
  const map = new Map<string, CardValuation[]>();

  for (const valuation of valuations) {
    const list = map.get(valuation.card_id) ?? [];
    list.push(valuation);
    map.set(valuation.card_id, list);
  }

  for (const [cardId, list] of map) {
    map.set(
      cardId,
      [...list].sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      )
    );
  }

  return map;
}
