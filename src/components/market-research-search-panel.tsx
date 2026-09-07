"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import {
  resolveResearchSport,
  slugifyResearchValue,
} from "@/lib/market-research/catalog";
import {
  searchDm2Players,
  searchDm2Sports,
} from "@/app/actions/data-model-v2";
import { Dm2CardSearchTiles } from "@/components/dm2-card-search-tiles";
import { formatDm2CardResearchTitle } from "@/components/dm2-card-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDm2CardLabel } from "@/lib/dm2-card-to-asset";
import { cn } from "@/lib/utils";
import type {
  Dm2PlayerSearchResult,
  Dm2SportSearchResult,
  MarketResearchSearchSelection,
} from "@/types/data-model-v2";

const SEARCH_INPUT_CLASS =
  "h-10 w-full min-w-0 rounded-xl border border-input bg-background py-2 pl-10 pr-10 text-base shadow-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function SearchFooter({ count, limit = 50 }: { count: number; limit?: number }) {
  return count >= limit ? (
    <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
      Showing first {limit} matches — refine your search for more.
    </p>
  ) : (
    <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
      {count} match{count === 1 ? "" : "es"}
    </p>
  );
}

function CatalogSearchField({
  value,
  onChange,
  placeholder,
  loading,
  expanded,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  loading: boolean;
  expanded: boolean;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        className={SEARCH_INPUT_CLASS}
        name="q"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
      />
      {loading ? (
        <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}

function Dm2PlayerSearchInput({
  onSelectPlayer,
  className,
  initialQuery = "",
  initialResults = [],
  initialError = null,
}: {
  onSelectPlayer: (player: Dm2PlayerSearchResult) => void;
  className?: string;
  initialQuery?: string;
  initialResults?: Dm2PlayerSearchResult[];
  initialError?: string | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Dm2PlayerSearchResult[]>(initialResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [searched, setSearched] = useState(
    initialQuery.trim().length >= 2 || initialResults.length > 0 || Boolean(initialError)
  );

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = debouncedQuery.length >= 2;
  const showResults = canSearch && results.length > 0;

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchDm2Players(debouncedQuery)
      .then((result) => {
        if (cancelled) return;
        setLoading(false);
        setSearched(true);
        if (result.error) {
          setError(result.error);
          setResults([]);
          return;
        }
        setResults(result.players ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setSearched(true);
        setError(err instanceof Error ? err.message : "Player search failed.");
        setResults([]);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, canSearch]);

  return (
    <form method="get" action="/market-research" className={cn("space-y-1", className)}>
      <input type="hidden" name="tab" value="player" />
      <CatalogSearchField
        value={query}
        onChange={setQuery}
        placeholder='Search players, e.g. "Wembanyama"'
        loading={loading}
        expanded={showResults}
      />
      <button type="submit" className="text-sm font-medium text-primary hover:underline">
        Search
      </button>

      {showResults ? (
        <div className="rounded-lg border border-border bg-popover py-1 shadow-md">
          <ul className="max-h-72 overflow-y-auto" role="listbox">
            {results.map((row) => (
              <li key={row.id} role="option">
                <Link
                  href={`/market-research/players/${row.id}`}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setQuery(row.player);
                    onSelectPlayer(row);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{row.player}</span>
                    <span className="block text-xs text-muted-foreground">{row.sport}</span>
                  </span>
                  {row.cardCount > 0 ? (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {row.cardCount} card{row.cardCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <SearchFooter count={results.length} />
        </div>
      ) : null}

      {loading && canSearch && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">Searching players…</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {searched && canSearch && !loading && !error && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching players in the catalog.</p>
      ) : null}
      {!canSearch && query.trim().length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters to search. Press Enter if results do not appear.
        </p>
      ) : null}
    </form>
  );
}

function Dm2SportSearchInput({
  onSelectSport,
  className,
  initialQuery = "",
  initialResults = [],
  initialError = null,
}: {
  onSelectSport: (sport: Dm2SportSearchResult) => void;
  className?: string;
  initialQuery?: string;
  initialResults?: Dm2SportSearchResult[];
  initialError?: string | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Dm2SportSearchResult[]>(initialResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [searched, setSearched] = useState(
    initialQuery.trim().length >= 2 || initialResults.length > 0 || Boolean(initialError)
  );

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = debouncedQuery.length >= 2;
  const showResults = canSearch && results.length > 0;

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchDm2Sports(debouncedQuery)
      .then((result) => {
        if (cancelled) return;
        setLoading(false);
        setSearched(true);
        if (result.error) {
          setError(result.error);
          setResults([]);
          return;
        }
        setResults(result.sports ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setSearched(true);
        setError(err instanceof Error ? err.message : "Sport search failed.");
        setResults([]);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, canSearch]);

  return (
    <form method="get" action="/market-research" className={cn("space-y-1", className)}>
      <input type="hidden" name="tab" value="sport" />
      <CatalogSearchField
        value={query}
        onChange={setQuery}
        placeholder='Search sports, e.g. "Basketball" or "NBA"'
        loading={loading}
        expanded={showResults}
      />
      <button type="submit" className="text-sm font-medium text-primary hover:underline">
        Search
      </button>

      {showResults ? (
        <div className="rounded-lg border border-border bg-popover py-1 shadow-md">
          <ul className="max-h-72 overflow-y-auto" role="listbox">
            {results.map((row) => (
              <li key={row.sport} role="option">
                <Link
                  href={`/market-research/markets/${resolveResearchSport(row.sport)?.slug ?? slugifyResearchValue(row.sport)}`}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setQuery(row.sport);
                    onSelectSport(row);
                  }}
                >
                  <span className="font-medium">{row.sport}</span>
                  {row.cardSetCount > 0 || row.cardCount > 0 ? (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {row.cardSetCount} set{row.cardSetCount === 1 ? "" : "s"} ·{" "}
                      {row.cardCount} card{row.cardCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <SearchFooter count={results.length} />
        </div>
      ) : null}

      {loading && canSearch && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">Searching sports…</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {searched && canSearch && !loading && !error && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching sports in the catalog.</p>
      ) : null}
      {!canSearch && query.trim().length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters to search. Press Enter if results do not appear.
        </p>
      ) : null}
    </form>
  );
}

export function formatMarketResearchSelectionLabel(
  selection: MarketResearchSearchSelection
): string {
  switch (selection.type) {
    case "card":
      return formatDm2CardResearchTitle(selection.card);
    case "player":
      return selection.player.player;
    case "sport":
      return selection.sport.sport;
  }
}

interface MarketResearchSearchPanelProps {
  activeTab: "card" | "player" | "sport";
  selection: MarketResearchSearchSelection | null;
  onSelectionChange: (selection: MarketResearchSearchSelection | null) => void;
  initialQuery?: string;
  initialPlayers?: Dm2PlayerSearchResult[];
  initialSports?: Dm2SportSearchResult[];
  initialSearchError?: string | null;
}

export function MarketResearchSearchPanel({
  activeTab,
  selection,
  onSelectionChange,
  initialQuery = "",
  initialPlayers = [],
  initialSports = [],
  initialSearchError = null,
}: MarketResearchSearchPanelProps) {
  const router = useRouter();
  const [searchSession, setSearchSession] = useState(0);
  const searchTab = activeTab;

  function handleSelectPlayer(player: Dm2PlayerSearchResult) {
    onSelectionChange({ type: "player", player });
    router.push(`/market-research/players/${player.id}`);
  }

  function handleSelectSport(sport: Dm2SportSearchResult) {
    onSelectionChange({ type: "sport", sport });
    const resolved = resolveResearchSport(sport.sport);
    router.push(
      `/market-research/markets/${resolved?.slug ?? slugifyResearchValue(sport.sport)}`
    );
  }

  function handleClear() {
    onSelectionChange(null);
    setSearchSession((session) => session + 1);
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-visible">
      <div className="border-b border-border/80 px-4 pt-4">
        <div className="flex w-full justify-start gap-1" role="tablist" aria-label="Catalog search">
          {(
            [
              ["card", "Card", "/market-research"],
              ["player", "Player", "/market-research?tab=player"],
              ["sport", "Sport", "/market-research?tab=sport"],
            ] as const
          ).map(([value, label, href]) => (
            <Link
              key={value}
              href={href}
              scroll={false}
              role="tab"
              aria-selected={searchTab === value}
              className={cn(
                "relative z-10 inline-flex h-8 cursor-pointer items-center justify-center px-3 text-sm font-medium",
                searchTab === value
                  ? "text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-foreground"
                  : "text-foreground/60 hover:text-foreground"
              )}
              onClick={() => {
                onSelectionChange(null);
                setSearchSession((session) => session + 1);
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1 min-w-0">
            {searchTab === "card" ? (
              <Dm2CardSearchTiles
                key={`market-card-search-${searchSession}`}
                className="w-full"
                inputClassName="bg-background"
                placeholder="Search players, sets, cards, or parallels…"
              />
            ) : null}
            {searchTab === "player" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Player search</p>
                <Dm2PlayerSearchInput
                  key={`market-player-search-${searchSession}`}
                  className="w-full"
                  onSelectPlayer={handleSelectPlayer}
                  initialQuery={activeTab === "player" ? initialQuery : ""}
                  initialResults={activeTab === "player" ? initialPlayers : []}
                  initialError={activeTab === "player" ? initialSearchError : null}
                />
              </div>
            ) : null}
            {searchTab === "sport" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Sport search</p>
                <Dm2SportSearchInput
                  key={`market-sport-search-${searchSession}`}
                  className="w-full"
                  onSelectSport={handleSelectSport}
                  initialQuery={activeTab === "sport" ? initialQuery : ""}
                  initialResults={activeTab === "sport" ? initialSports : []}
                  initialError={activeTab === "sport" ? initialSearchError : null}
                />
              </div>
            ) : null}
          </div>

            <Button variant="outline" className="gap-2 sm:w-auto shrink-0" disabled>
              <SlidersHorizontal className="h-4 w-4" />
              Advanced
            </Button>
          </div>

          {selection ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Selected:</span>
              <Badge variant="secondary" className="text-xs">
                {formatMarketResearchSelectionLabel(selection)}
              </Badge>
              {selection.type === "player" ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {selection.player.cardCount} cards in catalog
                </span>
              ) : null}
              {selection.type === "sport" ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {selection.sport.cardSetCount} sets · {selection.sport.cardCount} cards
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleClear}
              >
                Clear
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Try:</span>
              {(searchTab === "card"
                ? ["Wembanyama", "Prizm", "2024", "Fast Break"]
                : searchTab === "player"
                  ? ["Ohtani", "Mahomes", "Wembanyama"]
                  : ["Basketball", "Baseball", "Football"]
              ).map((term) => (
                <Badge key={term} variant="secondary" className="text-xs">
                  {term}
                </Badge>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}

export { formatDm2CardResearchTitle, formatDm2CardLabel };
