"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { searchCardRepositoryCards } from "@/app/actions/card-repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRepositoryCardLabel } from "@/lib/card-repository-to-asset";
import { cn } from "@/lib/utils";
import type { CardRepositorySearchResult } from "@/types/card-repository";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

interface AddCardSearchStepProps {
  onSelectCard: (card: CardRepositorySearchResult) => void;
  onAddManually: () => void;
}

export function AddCardSearchStep({
  onSelectCard,
  onAddManually,
}: AddCardSearchStepProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardRepositorySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = debouncedQuery.length >= 2;

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

    searchCardRepositoryCards(debouncedQuery).then((result) => {
      if (cancelled) return;

      setLoading(false);
      setSearched(true);

      if (result.error) {
        setError(result.error);
        setResults([]);
        return;
      }

      setResults(result.cards ?? []);
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
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleSelect(card: CardRepositorySearchResult) {
    setOpen(false);
    onSelectCard(card);
  }

  const showDropdown = open && canSearch && results.length > 0;
  const showNoResults =
    searched && canSearch && !loading && !error && results.length === 0;

  return (
    <div className="space-y-6">
      <div ref={containerRef} className="relative max-w-xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder='Search cards, e.g. "1987 Donruss Jose Canseco"'
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

        {showDropdown && (
          <ul
            className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover py-1 shadow-md"
            role="listbox"
          >
            {results.map((card) => (
              <li key={card.id} role="option">
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
                  )}
                  onClick={() => handleSelect(card)}
                >
                  {formatRepositoryCardLabel(card)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {showNoResults && (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center max-w-xl">
          <p className="text-sm font-medium">No matching cards found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search or add the card manually.
          </p>
          <Button
            type="button"
            variant="link"
            className="mt-3 px-0"
            onClick={onAddManually}
          >
            Add manually instead
          </Button>
        </div>
      )}

      {!canSearch && query.trim().length > 0 && (
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      )}
      <Button type="button" variant="outline" onClick={onAddManually}>
        Add manually
      </Button>
    </div>
  );
}
