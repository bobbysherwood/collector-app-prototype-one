import { normalizePlayerNameKey } from "@/lib/dm2-player-match";

export interface HoldingsCatalogPlayer {
  id: string;
  name: string;
  sport: string;
}

export function sameHoldingsSport(left: string, right: string): boolean {
  return normalizePlayerNameKey(left) === normalizePlayerNameKey(right);
}

export function pickCatalogPlayerForHoldings(
  players: HoldingsCatalogPlayer[],
  input: {
    playerId?: string | null;
    playerName: string;
    sport: string;
  }
): HoldingsCatalogPlayer | null {
  if (input.playerId) {
    const byId = players.find((player) => player.id === input.playerId);
    if (byId && sameHoldingsSport(byId.sport, input.sport)) return byId;
    return null;
  }

  const nameKey = normalizePlayerNameKey(input.playerName);
  if (!nameKey) return null;

  return (
    players.find(
      (player) =>
        sameHoldingsSport(player.sport, input.sport) &&
        normalizePlayerNameKey(player.name) === nameKey
    ) ?? null
  );
}
