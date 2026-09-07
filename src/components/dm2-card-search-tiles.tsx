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
import { cn } from "@/lib/utils";
import { DM2_CARD_SEARCH_PAGE_SIZE } from "@/types/data-model-v2";
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

function cardSearchHref(query: string, page = 1) {
  const params = new URLSearchParams();
  params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/market-research?${params.toString()}`;
}

interface Dm2CardSearchTilesProps {
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** When set, skips the search input and searches this query (e.g. selected player). */
  fixedQuery?: string;
  hideSearchInput?: boolean;
  pageSize?: number;
  initialQuery?: string;
  initialResults?: Dm2CardSearchResult[];
  initialTotalCount?: number;
  initialPage?: number;
  initialError?: string | null;
}

export function Dm2CardSearchTiles({
  placeholder = "Search players, sets, cards, or parallels…",
  className,
  inputClassName,
  fixedQuery,
  hideSearchInput = false,
  pageSize = DM2_CARD_SEARCH_PAGE_SIZE,
  initialQuery = "",
  initialResults = [],
  initialTotalCount = 0,
  initialPage = 1,
  initialError = null,
}: Dm2CardSearchTilesProps) {
  const [query, setQuery] = useState(fixedQuery ?? initialQuery);
  const [results, setResults] = useState<Dm2CardSearchResult[]>(initialResults);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [searched, setSearched] = useState(
    (fixedQuery ?? initialQuery).trim().length >= 2 ||
      initialResults.length > 0 ||
      Boolean(initialError)
  );

  useEffect(() => {
    if (fixedQuery !== undefined) {
      setQuery(fixedQuery);
      setPage(1);
    }
  }, [fixedQuery]);

  const debouncedQuery = useDebouncedValue(query.trim(), fixedQuery ? 0 : 300);
  const canSearch = debouncedQuery.length >= 2;
  const serverSnapshot =
    !fixedQuery &&
    debouncedQuery === initialQuery.trim() &&
    page === initialPage &&
    initialQuery.trim().length >= 2;

  useEffect(() => {
    if (debouncedQuery === initialQuery.trim()) return;
    setPage(1);
  }, [debouncedQuery, initialQuery]);

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setTotalCount(0);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }

    if (serverSnapshot) {
      setResults(initialResults);
      setTotalCount(initialTotalCount);
      setError(initialError);
      setSearched(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchDm2Cards(debouncedQuery, { page, pageSize })
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
        setTotalCount(result.totalCount ?? 0);
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
  }, [
    canSearch,
    debouncedQuery,
    initialError,
    initialResults,
    initialTotalCount,
    page,
    pageSize,
    serverSnapshot,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const useUrlPaging = !fixedQuery && !hideSearchInput;

  return (
    <div className={cn("space-y-4", className)}>
      {!hideSearchInput ? (
        <form method="get" action="/market-research" className="space-y-2">
          <p className="text-sm font-medium">Card search</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(SEARCH_INPUT_CLASS, inputClassName)}
              name="q"
              placeholder={placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
            {loading ? (
              <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <Button type="submit" className="w-full sm:w-auto">
            Search cards
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!hideSearchInput && !canSearch && query.trim().length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters to search. Press Search if results do not appear.
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
              <CardSearchPager
                page={page}
                totalPages={totalPages}
                query={debouncedQuery}
                loading={loading}
                useUrlPaging={useUrlPaging}
                onPageChange={setPage}
              />
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
              <CardSearchPager
                page={page}
                totalPages={totalPages}
                query={debouncedQuery}
                loading={loading}
                useUrlPaging={useUrlPaging}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CardSearchPager({
  page,
  totalPages,
  query,
  loading,
  useUrlPaging,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  query: string;
  loading: boolean;
  useUrlPaging: boolean;
  onPageChange: (page: number) => void;
}) {
  const prevClass =
    "inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="flex items-center gap-2">
      {useUrlPaging ? (
        page <= 1 ? (
          <span className={cn(prevClass, "pointer-events-none opacity-50")}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </span>
        ) : (
          <Link href={cardSearchHref(query, page - 1)} className={prevClass} scroll={false}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        )
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
      )}
      <span className="min-w-[7rem] text-center text-sm text-muted-foreground tabular-nums">
        Page {page} of {totalPages}
      </span>
      {useUrlPaging ? (
        page >= totalPages ? (
          <span className={cn(prevClass, "pointer-events-none opacity-50")}>
            Next
            <ChevronRight className="h-4 w-4" />
          </span>
        ) : (
          <Link href={cardSearchHref(query, page + 1)} className={prevClass} scroll={false}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        )
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
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
