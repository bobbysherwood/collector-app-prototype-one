"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { searchDm2Cards } from "@/app/actions/data-model-v2";
import { formatDm2CardResearchTitle } from "@/components/dm2-card-search-input";
import { Dm2CardAttributeBadges } from "@/components/dm2-card-attribute-badges";
import { getDm2CardImageUrl } from "@/lib/images";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DM2_CARD_SEARCH_PAGE_SIZE } from "@/types/data-model-v2";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

interface Dm2CardSearchTilesProps {
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** When set, skips the search input and searches this query (e.g. selected player). */
  fixedQuery?: string;
  hideSearchInput?: boolean;
  pageSize?: number;
}

export function Dm2CardSearchTiles({
  placeholder = "Search players, sets, cards, or parallels…",
  className,
  inputClassName,
  fixedQuery,
  hideSearchInput = false,
  pageSize = DM2_CARD_SEARCH_PAGE_SIZE,
}: Dm2CardSearchTilesProps) {
  const [query, setQuery] = useState(fixedQuery ?? "");
  const [results, setResults] = useState<Dm2CardSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (fixedQuery !== undefined) {
      setQuery(fixedQuery);
      setPage(1);
    }
  }, [fixedQuery]);

  const debouncedQuery = useDebouncedValue(query.trim(), fixedQuery ? 0 : 300);
  const canSearch = debouncedQuery.length >= 2;

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

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

    searchDm2Cards(debouncedQuery, { page, pageSize }).then((result) => {
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
      setTotalCount(result.totalCount ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, canSearch, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div className={cn("space-y-4", className)}>
      {!hideSearchInput ? (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className={cn("pl-10 bg-background", inputClassName)}
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {loading && (
            <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!hideSearchInput && !canSearch && query.trim().length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      ) : null}

      {canSearch && loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching catalog…
        </div>
      ) : null}

      {searched && canSearch && !loading && !error && results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          No matching cards in the catalog.
        </div>
      ) : null}

      {searched && !loading && results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{" "}
              {totalCount.toLocaleString()} result{totalCount === 1 ? "" : "s"}
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="min-w-[7rem] text-center text-sm text-muted-foreground tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((card) => (
              <li key={card.id}>
                <Dm2CardSearchTile card={card} />
              </li>
            ))}
          </ul>
          {totalPages > 1 ? (
            <div className="flex justify-center pt-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="min-w-[7rem] text-center text-sm text-muted-foreground tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Dm2CardSearchTile({ card }: { card: Dm2CardSearchResult }) {
  const title = formatDm2CardResearchTitle(card);
  const imageUrl = getDm2CardImageUrl(card.imagePath);

  return (
    <Link
      href={`/market-research/cards/${card.id}`}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-colors",
        "hover:border-primary/40 hover:bg-accent/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <div className="relative aspect-[2.5/3.5] w-full bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-contain p-2"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-5xl font-bold text-muted-foreground/20">
              {card.player.charAt(0)}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{title}</p>
          <p className="text-xs text-muted-foreground">
            {card.sportName}
            {card.cardNumber ? ` · #${card.cardNumber}` : ""}
          </p>
        </div>
        <div className="mt-auto space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px] font-normal">
              {card.year}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {card.brandName}
            </Badge>
            {card.parallelName ? (
              <Badge variant="secondary" className="text-[10px] font-normal">
                {card.parallelName}
              </Badge>
            ) : null}
          </div>
          <Dm2CardAttributeBadges names={card.attributeNames} size="sm" />
        </div>
      </div>
    </Link>
  );
}
