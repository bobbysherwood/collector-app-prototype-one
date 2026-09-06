"use client";

import { useEffect, useState } from "react";
import { searchDm2Players } from "@/app/actions/data-model-v2";
import { Input } from "@/components/ui/input";
import { normalizePlayerNameKey } from "@/lib/dm2-player-match";
import { sameHoldingsSport } from "@/lib/holdings-player";
import { cn } from "@/lib/utils";
import type { Dm2PlayerSearchResult } from "@/types/data-model-v2";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function HoldingsPlayerPicker({
  sport,
  playerId,
  playerName,
  onChange,
}: {
  sport: string;
  playerId: string | null;
  playerName: string;
  onChange: (next: { playerId: string | null; playerName: string }) => void;
}) {
  const [query, setQuery] = useState(playerName);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Dm2PlayerSearchResult[]>([]);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    setQuery(playerName);
  }, [playerName]);

  useEffect(() => {
    let cancelled = false;
    if (debouncedQuery.trim().length < 2) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void searchDm2Players(debouncedQuery).then((result) => {
      if (cancelled) return;
      setLoading(false);
      const players = (result.players ?? []).filter((player) =>
        sameHoldingsSport(player.sport, sport)
      );
      setMatches(players);
      const exact = players.find(
        (player) =>
          normalizePlayerNameKey(player.player) ===
          normalizePlayerNameKey(debouncedQuery)
      );
      if (exact && !playerId) {
        onChange({ playerId: exact.id, playerName: exact.player });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, sport, playerId]);

  return (
    <div className="relative space-y-1">
      <Input
        id="player_name"
        required
        value={query}
        autoComplete="off"
        placeholder="Search catalog players"
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          onChange({ playerId: null, playerName: next });
        }}
      />
      {playerId ? (
        <p className="text-xs text-muted-foreground">Linked to the Player table</p>
      ) : query.trim() ? (
        <p className="text-xs text-muted-foreground">
          Pick a catalog player. Add missing names in Data Model v2 first.
        </p>
      ) : null}
      {open && debouncedQuery.trim().length >= 2 ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover py-1 shadow-md">
          {loading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No catalog players match in {sport}.
            </p>
          ) : (
            matches.map((player) => (
              <button
                key={player.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted",
                  player.id === playerId && "bg-muted"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange({ playerId: player.id, playerName: player.player });
                  setQuery(player.player);
                  setOpen(false);
                }}
              >
                <span>{player.player}</span>
                <span className="text-xs text-muted-foreground">{player.sport}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
