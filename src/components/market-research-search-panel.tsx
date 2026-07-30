"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import {
  searchDm2Players,
  searchDm2Sports,
} from "@/app/actions/data-model-v2";
import { Dm2CardSearchTiles } from "@/components/dm2-card-search-tiles";
import { formatDm2CardResearchTitle } from "@/components/dm2-card-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortalDropdown } from "@/lib/use-portal-dropdown";
import { formatDm2CardLabel } from "@/lib/dm2-card-to-asset";
import { cn } from "@/lib/utils";
import type {
  Dm2PlayerSearchResult,
  Dm2SportSearchResult,
  MarketResearchSearchSelection,
} from "@/types/data-model-v2";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function PortalDropdown({
  rect,
  children,
}: {
  rect: { top: number; left: number; width: number };
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      data-dm2-search-dropdown
      className="fixed z-[100] rounded-lg border border-border bg-popover py-1 shadow-md"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
      }}
    >
      {children}
    </div>,
    document.body
  );
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

function Dm2PlayerSearchInput({
  onSelectPlayer,
  className,
}: {
  onSelectPlayer: (player: Dm2PlayerSearchResult) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Dm2PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = debouncedQuery.length >= 2;
  const showDropdown = open && canSearch && results.length > 0;
  const dropdownRect = usePortalDropdown(showDropdown, inputRef, results.length);

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

    searchDm2Players(debouncedQuery).then((result) => {
      if (cancelled) return;
      setLoading(false);
      setSearched(true);
      if (result.error) {
        setError(result.error);
        setResults([]);
        return;
      }
      setResults(result.players ?? []);
      setOpen(true);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, canSearch]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !(event.target instanceof Element && event.target.closest("[data-dm2-search-dropdown]"))
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          className="pl-10 bg-background"
          placeholder='Search players, e.g. "Wembanyama"'
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && dropdownRect && (
        <PortalDropdown rect={dropdownRect}>
          <ul className="max-h-72 overflow-y-auto" role="listbox">
            {results.map((row) => (
              <li key={row.player} role="option">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setOpen(false);
                    setQuery(row.player);
                    onSelectPlayer(row);
                  }}
                >
                  <span className="font-medium">{row.player}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {row.cardCount} card{row.cardCount === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <SearchFooter count={results.length} />
        </PortalDropdown>
      )}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {searched && canSearch && !loading && !error && results.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No matching players in the catalog.</p>
      ) : null}
      {!canSearch && query.trim().length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      ) : null}
    </div>
  );
}

function Dm2SportSearchInput({
  onSelectSport,
  className,
}: {
  onSelectSport: (sport: Dm2SportSearchResult) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Dm2SportSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = debouncedQuery.length >= 2;
  const showDropdown = open && canSearch && results.length > 0;
  const dropdownRect = usePortalDropdown(showDropdown, inputRef, results.length);

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

    searchDm2Sports(debouncedQuery).then((result) => {
      if (cancelled) return;
      setLoading(false);
      setSearched(true);
      if (result.error) {
        setError(result.error);
        setResults([]);
        return;
      }
      setResults(result.sports ?? []);
      setOpen(true);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, canSearch]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !(event.target instanceof Element && event.target.closest("[data-dm2-search-dropdown]"))
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          className="pl-10 bg-background"
          placeholder='Search sports, e.g. "Basketball"'
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && dropdownRect && (
        <PortalDropdown rect={dropdownRect}>
          <ul className="max-h-72 overflow-y-auto" role="listbox">
            {results.map((row) => (
              <li key={row.sport} role="option">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setOpen(false);
                    setQuery(row.sport);
                    onSelectSport(row);
                  }}
                >
                  <span className="font-medium">{row.sport}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {row.cardSetCount} set{row.cardSetCount === 1 ? "" : "s"} ·{" "}
                    {row.cardCount} card{row.cardCount === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <SearchFooter count={results.length} />
        </PortalDropdown>
      )}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {searched && canSearch && !loading && !error && results.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No matching sports in the catalog.</p>
      ) : null}
      {!canSearch && query.trim().length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      ) : null}
    </div>
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
  selection: MarketResearchSearchSelection | null;
  onSelectionChange: (selection: MarketResearchSearchSelection | null) => void;
}

export function MarketResearchSearchPanel({
  selection,
  onSelectionChange,
}: MarketResearchSearchPanelProps) {
  const [searchTab, setSearchTab] = useState<"card" | "player" | "sport">("card");
  const [searchSession, setSearchSession] = useState(0);

  function handleTabChange(value: string) {
    const next = value as "card" | "player" | "sport";
    setSearchTab(next);
    onSelectionChange(null);
    setSearchSession((session) => session + 1);
  }

  function handleSelectPlayer(player: Dm2PlayerSearchResult) {
    onSelectionChange({ type: "player", player });
  }

  function handleSelectSport(sport: Dm2SportSearchResult) {
    onSelectionChange({ type: "sport", sport });
  }

  function handleClear() {
    onSelectionChange(null);
    setSearchSession((session) => session + 1);
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-visible">
      <Tabs value={searchTab} onValueChange={handleTabChange}>
        <div className="border-b border-border/80 px-4 pt-4">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="card">Card</TabsTrigger>
            <TabsTrigger value="player">Player</TabsTrigger>
            <TabsTrigger value="sport">Sport</TabsTrigger>
          </TabsList>
        </div>

        <div className="px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1 min-w-0">
              <TabsContent value="card" className="mt-0">
                <Dm2CardSearchTiles
                  key={`market-card-search-${searchSession}`}
                  className="w-full"
                  inputClassName="bg-background"
                  placeholder="Search players, sets, cards, or parallels…"
                />
              </TabsContent>
              <TabsContent value="player" className="mt-0">
                <Dm2PlayerSearchInput
                  key={`market-player-search-${searchSession}`}
                  className="w-full"
                  onSelectPlayer={handleSelectPlayer}
                />
              </TabsContent>
              <TabsContent value="sport" className="mt-0">
                <Dm2SportSearchInput
                  key={`market-sport-search-${searchSession}`}
                  className="w-full"
                  onSelectSport={handleSelectSport}
                />
              </TabsContent>
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
      </Tabs>
    </div>
  );
}

export { formatDm2CardResearchTitle, formatDm2CardLabel };
