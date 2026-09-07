"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Search } from "lucide-react";
import { searchDm2Cards } from "@/app/actions/data-model-v2";
import { formatDm2CardLabel } from "@/lib/dm2-card-to-asset";
import { cn } from "@/lib/utils";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

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

interface Dm2CardSearchInputProps {
  onSelectCard: (card: Dm2CardSearchResult) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
  noResultsFallback?: ReactNode;
}

export function Dm2CardSearchInput({
  onSelectCard,
  placeholder = 'Search cards, e.g. "2024 Prizm Victor Wembanyama"',
  className,
  inputClassName,
  initialQuery = "",
  onQueryChange,
  noResultsFallback,
}: Dm2CardSearchInputProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Dm2CardSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = debouncedQuery.length >= 2;
  const showResults = canSearch && results.length > 0;

  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setTotalCount(0);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchDm2Cards(debouncedQuery, { page: 1, pageSize: 50 })
      .then((result) => {
        if (cancelled) return;

        setLoading(false);
        setSearched(true);

        if (result.error) {
          setError(result.error);
          setResults([]);
          setTotalCount(0);
          return;
        }

        setResults(result.cards ?? []);
        setTotalCount(result.totalCount ?? result.cards?.length ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setSearched(true);
        setError(err instanceof Error ? err.message : "Card search failed.");
        setResults([]);
        setTotalCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, canSearch]);

  const showNoResults =
    searched && canSearch && !loading && !error && results.length === 0;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className={cn(SEARCH_INPUT_CLASS, inputClassName)}
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showResults}
        />
        {loading ? (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {showResults ? (
        <div className="rounded-lg border border-border bg-popover py-1 shadow-md">
          <ul className="max-h-72 overflow-y-auto" role="listbox">
            {results.map((card) => (
              <li key={card.id} role="option">
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
                  )}
                  onClick={() => {
                    setQuery(formatDm2CardLabel(card));
                    onSelectCard(card);
                  }}
                >
                  {formatDm2CardLabel(card)}
                </button>
              </li>
            ))}
          </ul>
          {totalCount > results.length ? (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Showing first {results.length} of {totalCount.toLocaleString()} matches — use
              Market Research card search for full paginated results.
            </p>
          ) : (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {totalCount} match{totalCount === 1 ? "" : "es"}
            </p>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {showNoResults
        ? noResultsFallback ?? (
            <p className="mt-2 text-sm text-muted-foreground">
              No matching cards in the catalog.
            </p>
          )
        : null}

      {!canSearch && query.trim().length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      ) : null}
    </div>
  );
}

export function formatDm2CardResearchTitle(card: Dm2CardSearchResult): string {
  const parallel = card.parallelName ? ` ${card.parallelName}` : "";
  return `${card.player} — ${card.year} ${card.brandName} ${card.cardSetName}${parallel}`;
}
