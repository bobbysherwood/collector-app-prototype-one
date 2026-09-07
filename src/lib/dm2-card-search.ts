export function cardSearchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function playerNameContainsAllTokens(
  playerName: string,
  tokens: string[]
): boolean {
  if (tokens.length === 0) return false;
  const name = playerName.toLowerCase();
  return tokens.every((token) => name.includes(token));
}

export function pickUniqueLabeledMatch<T>(
  query: string,
  items: T[],
  label: (item: T) => string
): T | null {
  const tokens = cardSearchTokens(query);
  if (tokens.length === 0) return null;

  const tokenHits = items.filter((item) =>
    playerNameContainsAllTokens(label(item), tokens)
  );
  const normalized = query.trim().toLowerCase();
  const exact = tokenHits.filter(
    (item) => label(item).trim().toLowerCase() === normalized
  );
  if (exact.length === 1) return exact[0] ?? null;
  if (exact.length === 0 && tokenHits.length === 1) return tokenHits[0] ?? null;
  return null;
}

/** Use the player-card RPC when the query is unambiguously one catalog player. */
export function pickUniqueSearchPlayer<T extends { id: string; player: string }>(
  query: string,
  players: T[]
): T | null {
  return pickUniqueLabeledMatch(query, players, (player) => player.player);
}

/** Use the sport-card RPC when the query is unambiguously one catalog sport. */
export function pickUniqueSearchSport<T extends { id: string; label: string }>(
  query: string,
  sports: T[]
): T | null {
  return pickUniqueLabeledMatch(query, sports, (sport) => sport.label);
}

export function formatCatalogSearchError(message: string): string {
  if (/timeout|canceling statement/i.test(message)) {
    return "The card catalog timed out for this search. Try a more specific query.";
  }
  if (/structure of query does not match function result type/i.test(message)) {
    return "Card catalog search needs a database update. Run supabase/migrations/064_dm2_cards_search_cast_fix.sql in the Supabase SQL editor, then open Settings → API and reload the schema cache.";
  }
  return message;
}
