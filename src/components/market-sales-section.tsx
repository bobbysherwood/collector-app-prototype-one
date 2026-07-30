"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, LineChart, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Asset, Lot } from "@/types/asset";
import type {
  MarketListing,
  MarketSale,
  MarketSaleSource,
  MarketSalesResult,
} from "@/types/market-sales";
import {
  MARKET_LISTING_TYPE_LABELS,
  MARKET_SALE_SOURCE_LABELS,
  MARKET_SALE_TYPE_LABELS,
} from "@/types/market-sales";
import { formatCurrency, formatPercent, gradeLabel } from "@/types/card";
import type { MarketOutlook, MarketPredictionInsight } from "@/types/market-predictions";
import { buildMarketSalesSummary } from "@/lib/market-sales/summary";
import {
  formatListingEndsAt,
  formatListingTimeRemaining,
  formatListingsAsOf,
} from "@/lib/market-sales/listing-format";
import { listingGradeFilterKey } from "@/lib/ebay/grade-parser";
import {
  estimateMarketValue,
  MARKET_ESTIMATE_CONFIDENCE_LABELS,
} from "@/lib/market-sales/estimate";
import type { MarketEstimateConfidence } from "@/lib/market-sales/estimate";
import {
  analyzeListing,
  LISTING_PREDICTION_LABELS,
  type ListingAnalysis,
  type ListingValuePrediction,
} from "@/lib/market-sales/listing-analysis";
import {
  filterMarketSales,
  filterMarketListings,
  MARKET_SALES_PERIOD_OPTIONS,
  type MarketListingsTypeFilter,
  type MarketSalesPeriodFilter,
  type MarketSalesSourceFilter,
} from "@/lib/market-sales/period-filter";
import { MarketSalesChart } from "@/components/market-sales-chart";
import { computeRecentSalesTrend } from "@/lib/market-sales/trend";
import { cn } from "@/lib/utils";

function filterSalesByGradeKeys(
  sales: MarketSale[],
  selectedGradeKeys: string[]
): MarketSale[] {
  if (selectedGradeKeys.length === 0) return [];
  const selected = new Set(selectedGradeKeys);
  return sales.filter((sale) =>
    selected.has(listingGradeFilterKey(sale.grader, sale.grade))
  );
}

type SourceFilter = MarketSalesSourceFilter;
type PeriodFilter = MarketSalesPeriodFilter;
type ListingTypeFilter = MarketListingsTypeFilter;
type MarketTab = "sales-history" | "listings";

interface MarketSalesSectionProps {
  asset: Asset;
  lots: Lot[];
  data: MarketSalesResult;
  ebayListings: MarketListing[];
  listingsAsOf: string | null;
  listingsError?: string;
  /** When true, show sandbox-specific empty-state guidance. */
  ebaySandboxMode?: boolean;
  /** When false, hides the preview banner on Sales History. */
  preview?: boolean;
  /** Market research outlook; merges outlook UI into this section when set. */
  predictions?: MarketPredictionInsight;
}

export function MarketSalesSection({
  data,
  ebayListings,
  listingsAsOf,
  listingsError,
  ebaySandboxMode = false,
  preview = true,
  predictions,
}: MarketSalesSectionProps) {
  const [activeTab, setActiveTab] = useState<MarketTab>("sales-history");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("90d");
  const [listingTypeFilter, setListingTypeFilter] =
    useState<ListingTypeFilter>("all");
  const [selectedSalesGradeKeys, setSelectedSalesGradeKeys] = useState<string[]>(
    []
  );
  const [selectedListingGradeKeys, setSelectedListingGradeKeys] = useState<
    string[]
  >([]);

  const filteredSales = useMemo(
    () => filterMarketSales(data.sales, sourceFilter, periodFilter),
    [data.sales, sourceFilter, periodFilter]
  );

  const salesGradeFilterOptions = useMemo(() => {
    const keys = new Set(
      filteredSales.map((sale) =>
        listingGradeFilterKey(sale.grader, sale.grade)
      )
    );
    return [...keys].sort((a, b) => a.localeCompare(b));
  }, [filteredSales]);

  useEffect(() => {
    setSelectedSalesGradeKeys(salesGradeFilterOptions);
  }, [salesGradeFilterOptions]);

  const gradeFilteredSales = useMemo(
    () => filterSalesByGradeKeys(filteredSales, selectedSalesGradeKeys),
    [filteredSales, selectedSalesGradeKeys]
  );

  const listingsByType = useMemo(
    () => filterMarketListings(ebayListings, "all", listingTypeFilter),
    [ebayListings, listingTypeFilter]
  );

  const listingGradeFilterOptions = useMemo(() => {
    const keys = new Set(
      listingsByType.map((listing) =>
        listingGradeFilterKey(listing.grader, listing.grade)
      )
    );
    return [...keys].sort((a, b) => a.localeCompare(b));
  }, [listingsByType]);

  useEffect(() => {
    setSelectedListingGradeKeys(listingGradeFilterOptions);
  }, [listingGradeFilterOptions]);

  const filteredListings = useMemo(() => {
    if (selectedListingGradeKeys.length === 0) return [];
    const selected = new Set(selectedListingGradeKeys);
    return listingsByType.filter((listing) =>
      selected.has(listingGradeFilterKey(listing.grader, listing.grade))
    );
  }, [listingsByType, selectedListingGradeKeys]);

  const summary = useMemo(
    () => buildMarketSalesSummary(gradeFilteredSales),
    [gradeFilteredSales]
  );

  const lastSale = useMemo(() => {
    if (gradeFilteredSales.length === 0) return null;
    return [...gradeFilteredSales].sort((a, b) =>
      b.sale_date.localeCompare(a.sale_date)
    )[0];
  }, [gradeFilteredSales]);

  const estimatedValue = useMemo(
    () => estimateMarketValue(gradeFilteredSales),
    [gradeFilteredSales]
  );

  const salesTrend = useMemo(
    () => computeRecentSalesTrend(gradeFilteredSales),
    [gradeFilteredSales]
  );

  const listingAnalyses = useMemo(() => {
    const analyses = new Map<string, ListingAnalysis>();
    for (const listing of filteredListings) {
      analyses.set(
        listing.id,
        analyzeListing(listing, filteredSales, predictions)
      );
    }
    return analyses;
  }, [filteredListings, filteredSales, predictions]);

  const salesHistoryFilters = (
    <>
      <Select
        value={sourceFilter}
        onValueChange={(value) =>
          setSourceFilter((value as SourceFilter) ?? "all")
        }
      >
        <SelectTrigger size="sm" className="w-[160px]">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          <SelectItem value="ebay">eBay</SelectItem>
          <SelectItem value="fanatics_collect">Fanatics Collect</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={periodFilter}
        onValueChange={(value) =>
          setPeriodFilter((value as PeriodFilter) ?? "90d")
        }
      >
        <SelectTrigger size="sm" className="w-[140px]">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          {MARKET_SALES_PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <GradeFilterDropdown
        options={salesGradeFilterOptions}
        selected={selectedSalesGradeKeys}
        onChange={setSelectedSalesGradeKeys}
      />
    </>
  );

  const listingsFilters = (
    <>
      <Select
        value={listingTypeFilter}
        onValueChange={(value) =>
          setListingTypeFilter((value as ListingTypeFilter) ?? "all")
        }
      >
        <SelectTrigger size="sm" className="w-[140px]">
          <SelectValue placeholder="Listing type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="auction">Auction</SelectItem>
          <SelectItem value="buy_it_now">Buy It Now</SelectItem>
        </SelectContent>
      </Select>
      <GradeFilterDropdown
        options={listingGradeFilterOptions}
        selected={selectedListingGradeKeys}
        onChange={setSelectedListingGradeKeys}
      />
    </>
  );

  const marketStatsGrid = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <SummaryStat
        label="Last sale"
        value={lastSale ? formatCurrency(lastSale.sale_price) : "—"}
        subtitle={lastSale?.sale_date}
      />
      <SummaryStat
        label="Price range"
        value={
          summary.low_price != null && summary.high_price != null
            ? `${formatCurrency(summary.low_price)} – ${formatCurrency(summary.high_price)}`
            : "—"
        }
      />
      <EstimatedValueStat estimate={estimatedValue} />
      <SummaryStat
        label="30-day change"
        value={
          salesTrend.change30d === 0
            ? "Flat"
            : formatPercent(Math.abs(salesTrend.change30d))
        }
        subtitle={`${salesTrend.volume30d} comps${
          salesTrend.avgPrice30d != null
            ? ` · avg ${formatCurrency(salesTrend.avgPrice30d)}`
            : ""
        }`}
        positive={
          salesTrend.change30d > 0
            ? true
            : salesTrend.change30d < 0
              ? false
              : undefined
        }
      />
      <SummaryStat
        label="90-day change"
        value={
          salesTrend.change90d === 0
            ? "Flat"
            : formatPercent(Math.abs(salesTrend.change90d))
        }
        subtitle={`${salesTrend.volume90d} comps${
          salesTrend.avgPrice90d != null
            ? ` · avg ${formatCurrency(salesTrend.avgPrice90d)}`
            : ""
        }`}
        positive={
          salesTrend.change90d > 0
            ? true
            : salesTrend.change90d < 0
              ? false
              : undefined
        }
      />
    </div>
  );

  const aiInsightsTile = predictions ? (
    <div className="rounded-xl border border-border/80 bg-muted/10 px-4 py-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        AI Insights
      </p>
      <div className="space-y-2">
        {predictions.commentary.map((paragraph, index) => (
          <p key={index} className="text-sm leading-relaxed text-foreground/90">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {predictions ? (
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            ) : (
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            )}
            {predictions ? "Market Outlook & Sales" : "Market Sales"}
          </CardTitle>
          <CardDescription>
            {predictions
              ? "Recent comps, market forecast, and active listings for this card"
              : "Comparable sales and active eBay listings for this card"}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {predictions ? (
            <>
              <OutlookBadge outlook={predictions.outlook} />
              <Badge variant="outline" className="text-xs font-normal capitalize">
                {predictions.confidence} confidence
              </Badge>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {preview && activeTab === "sales-history" && (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {predictions
              ? "Sales history and market outlook use sample data for design preview."
              : "Sales History uses sample comp data — eBay sold listings will be added in a later phase."}
          </div>
        )}

        {listingsError && activeTab === "listings" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {listingsError}
          </div>
        )}

        {marketStatsGrid}
        {aiInsightsTile}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab((value as MarketTab) ?? "sales-history")}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="sales-history">Sales History</TabsTrigger>
              <TabsTrigger value="listings">Listings</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === "sales-history" ? salesHistoryFilters : listingsFilters}
            </div>
          </div>

          <TabsContent value="sales-history" className="mt-4 space-y-4">
            <div className="rounded-xl border border-border/80 bg-muted/10 px-4 py-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sales over time
              </p>
              <MarketSalesChart sales={gradeFilteredSales} />
            </div>

            {gradeFilteredSales.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No comparable sales match the selected filters.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sale Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Sale Price</TableHead>
                      <TableHead className="text-right">Match</TableHead>
                      <TableHead className="w-[1%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradeFilteredSales.map((sale) => (
                      <MarketSaleRow key={sale.id} sale={sale} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="listings" className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryStat
                label="Active listings"
                value={String(filteredListings.length)}
              />
              <SummaryStat
                label="Lowest ask"
                value={
                  filteredListings.length > 0
                    ? formatCurrency(
                        Math.min(...filteredListings.map((listing) => listing.price))
                      )
                    : "—"
                }
              />
              <SummaryStat
                label="Ending soonest"
                value={
                  filteredListings.length > 0
                    ? formatListingTimeRemaining(
                        [...filteredListings].sort((a, b) =>
                          a.ends_at.localeCompare(b.ends_at)
                        )[0].ends_at
                      )
                    : "—"
                }
              />
            </div>

            {filteredListings.length === 0 ? (
              <div className="space-y-3 py-8">
                <p className="text-center text-sm text-muted-foreground">
                  {ebayListings.length === 0
                    ? "No active eBay listings found for this card."
                    : "No listings match the selected filters."}
                </p>
                {ebaySandboxMode &&
                  ebayListings.length === 0 &&
                  !listingsError && (
                    <div className="mx-auto max-w-lg rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground/80">
                        eBay sandbox limitation
                      </p>
                      <p className="mt-1.5">
                        Sandbox Browse search usually does not index listings
                        published through the Sell API, even when they appear in
                        your seller account. This app falls back to your seeded
                        test listings (SKU pattern{" "}
                        <code className="rounded bg-muted px-1 py-0.5">
                          cp-…-1
                        </code>
                        ) when{" "}
                        <code className="rounded bg-muted px-1 py-0.5">
                          EBAY_USER_REFRESH_TOKEN
                        </code>{" "}
                        is set. Run{" "}
                        <code className="rounded bg-muted px-1 py-0.5">
                          npm run ebay:create-listings
                        </code>{" "}
                        to seed listings, then reload this page.
                      </p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ends</TableHead>
                      <TableHead>Time left</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">vs Market</TableHead>
                      <TableHead>Prediction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredListings.map((listing) => (
                      <MarketListingRow
                        key={listing.id}
                        listing={listing}
                        analysis={
                          listingAnalyses.get(listing.id) ??
                          analyzeListing(listing, filteredSales, predictions)
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {listingsAsOf && (
              <p className="text-xs text-muted-foreground">
                eBay listings as of {formatListingsAsOf(listingsAsOf)} · refreshed
                at most once per calendar day
              </p>
            )}
          </TabsContent>
        </Tabs>

        {data.as_of && activeTab === "sales-history" && (
          <p className="text-xs text-muted-foreground">
            Data as of {formatAsOf(data.as_of)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MarketSaleRow({ sale }: { sale: MarketSale }) {
  return (
    <TableRow>
      <TableCell className="tabular-nums whitespace-nowrap">
        {sale.sale_date}
      </TableCell>
      <TableCell>
        <SourceBadge source={sale.source} />
      </TableCell>
      <TableCell className="text-sm">
        {sale.grader
          ? gradeLabel({
              grader: sale.grader,
              grade: sale.grade,
              cert_number: null,
            })
          : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {MARKET_SALE_TYPE_LABELS[sale.sale_type]}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        <div>{formatCurrency(sale.sale_price)}</div>
        {sale.hammer_price != null && sale.buyers_premium_pct != null && (
          <div className="text-xs text-muted-foreground font-normal">
            {formatCurrency(sale.hammer_price)} + {sale.buyers_premium_pct}%
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <MatchBadge confidence={sale.match_confidence} />
      </TableCell>
      <TableCell>
        <Link
          href={sale.listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-muted-foreground hover:text-primary transition-colors"
          aria-label={`View listing on ${MARKET_SALE_SOURCE_LABELS[sale.source]}`}
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </TableCell>
    </TableRow>
  );
}

function MarketListingRow({
  listing,
  analysis,
}: {
  listing: MarketListing;
  analysis: ListingAnalysis;
}) {
  const recommended = analysis.buySignal === "recommended";
  const doNotBuy = analysis.buySignal === "do_not_buy";

  return (
    <TableRow
      className={cn(
        recommended &&
          "bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15",
        doNotBuy &&
          "bg-destructive/5 hover:bg-destructive/10 dark:bg-destructive/10 dark:hover:bg-destructive/15"
      )}
    >
      <TableCell
        className={cn(
          "whitespace-nowrap text-sm tabular-nums",
          recommended && "border-l-2 border-l-emerald-500/50",
          doNotBuy && "border-l-2 border-l-destructive/50"
        )}
      >
        {formatListingEndsAt(listing.ends_at)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">
        {formatListingTimeRemaining(listing.ends_at)}
      </TableCell>
      <TableCell className="max-w-[min(24rem,40vw)] text-sm">
        <Link
          href={listing.listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 font-medium leading-snug hover:text-primary hover:underline"
          title={listing.title}
        >
          {listing.title}
        </Link>
      </TableCell>
      <TableCell className="text-sm">
        {listing.grader
          ? gradeLabel({
              grader: listing.grader,
              grade: listing.grade,
              cert_number: null,
            })
          : "Raw"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-1.5">
          {MARKET_LISTING_TYPE_LABELS[listing.listing_type]}
          {recommended && <RecommendedBuyBadge />}
          {doNotBuy && <DoNotBuyBadge />}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        <div>{formatCurrency(listing.price)}</div>
        <div className="text-xs font-normal text-muted-foreground">
          {listing.listing_type === "auction" ? "Current bid" : "Buy now"}
        </div>
      </TableCell>
      <TableCell className="text-right text-sm">
        <ListingComparisonCell analysis={analysis} />
      </TableCell>
      <TableCell>
        <ListingPredictionBadge prediction={analysis.prediction} />
      </TableCell>
    </TableRow>
  );
}

function GradeFilterDropdown({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const allSelected =
    options.length > 0 && selected.length === options.length;

  const label =
    selected.length === 0
      ? "No grades"
      : allSelected
        ? "All grades"
        : `${selected.length} grade${selected.length === 1 ? "" : "s"}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            {label}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No grade options
          </p>
        ) : (
          <>
            <DropdownMenuCheckboxItem
              checked={allSelected}
              onCheckedChange={(checked) => {
                onChange(checked ? [...options] : []);
              }}
            >
              Select all
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option}
                checked={selected.includes(option)}
                onCheckedChange={(checked) => {
                  onChange(
                    checked
                      ? [...selected, option].sort((a, b) => a.localeCompare(b))
                      : selected.filter((value) => value !== option)
                  );
                }}
              >
                {option}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SourceBadge({ source }: { source: MarketSaleSource }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-normal",
        source === "ebay" && "border-primary/30 text-primary",
        source === "fanatics_collect" && "border-amber-500/40 text-amber-700 dark:text-amber-400"
      )}
    >
      {MARKET_SALE_SOURCE_LABELS[source]}
    </Badge>
  );
}

function RecommendedBuyBadge() {
  return (
    <Badge
      variant="outline"
      className="text-xs font-normal border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
    >
      Recommended buy
    </Badge>
  );
}

function DoNotBuyBadge() {
  return (
    <Badge
      variant="outline"
      className="text-xs font-normal border-destructive/40 text-destructive"
    >
      Do not buy
    </Badge>
  );
}

function ListingComparisonCell({ analysis }: { analysis: ListingAnalysis }) {
  if (
    analysis.vsEstimatedPct == null &&
    analysis.vsLastSalePct == null &&
    analysis.vsRecentMedianPct == null
  ) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-0.5 tabular-nums">
      {analysis.vsEstimatedPct != null ? (
        <ComparisonLine label="Est" value={analysis.vsEstimatedPct} />
      ) : null}
      {analysis.vsLastSalePct != null ? (
        <ComparisonLine label="Last" value={analysis.vsLastSalePct} />
      ) : null}
      {analysis.vsRecentMedianPct != null ? (
        <ComparisonLine label="90d med" value={analysis.vsRecentMedianPct} />
      ) : null}
    </div>
  );
}

function ComparisonLine({ label, value }: { label: string; value: number }) {
  const positive = value < 0;
  const negative = value > 0;

  return (
    <div
      className={cn(
        "text-xs",
        positive && "text-emerald-600 dark:text-emerald-400",
        negative && "text-destructive",
        !positive && !negative && "text-muted-foreground"
      )}
    >
      <span className="text-muted-foreground">{label} </span>
      {value > 0 ? "+" : ""}
      {formatPercent(Math.abs(value))}
    </div>
  );
}

function ListingPredictionBadge({
  prediction,
}: {
  prediction: ListingValuePrediction;
}) {
  const config = {
    up: {
      label: LISTING_PREDICTION_LABELS.up,
      className:
        "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5",
      icon: TrendingUp,
    },
    down: {
      label: LISTING_PREDICTION_LABELS.down,
      className: "border-destructive/40 text-destructive bg-destructive/5",
      icon: TrendingDown,
    },
    flat: {
      label: LISTING_PREDICTION_LABELS.flat,
      className: "border-border text-muted-foreground bg-muted/30",
      icon: Minus,
    },
  }[prediction];

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1 text-xs font-normal", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function MatchBadge({
  confidence,
}: {
  confidence: MarketSale["match_confidence"];
}) {
  const label =
    confidence === "high"
      ? "High"
      : confidence === "medium"
        ? "Medium"
        : "Low";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-normal",
        confidence === "high" && "bg-primary/10 text-primary",
        confidence === "low" && "text-muted-foreground"
      )}
    >
      {label}
    </Badge>
  );
}

function OutlookBadge({ outlook }: { outlook: MarketOutlook }) {
  const config = {
    bullish: {
      label: "Bullish",
      className:
        "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5",
      icon: TrendingUp,
    },
    bearish: {
      label: "Bearish",
      className: "border-destructive/40 text-destructive bg-destructive/5",
      icon: TrendingDown,
    },
    neutral: {
      label: "Neutral",
      className: "border-border text-muted-foreground bg-muted/30",
      icon: LineChart,
    },
  }[outlook];

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1 text-xs font-normal", config.className)}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

function EstimatedValueStat({
  estimate,
}: {
  estimate: ReturnType<typeof estimateMarketValue>;
}) {
  const confidenceLabel =
    MARKET_ESTIMATE_CONFIDENCE_LABELS[estimate.confidence];

  const detail =
    estimate.comp_count > 0
      ? `${estimate.comp_count} comp${estimate.comp_count === 1 ? "" : "s"} · ${estimate.recent_comp_count} in last 30 days`
      : undefined;

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Estimated value
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {estimate.value != null ? formatCurrency(estimate.value) : "—"}
      </p>
      {estimate.confidence !== "none" && (
        <div className="mt-2 space-y-1.5">
          <ConfidenceMeter
            score={estimate.confidence_score}
            level={estimate.confidence}
          />
          <p className={cn("text-xs font-medium", confidenceTextClass(estimate.confidence))}>
            {confidenceLabel}
          </p>
        </div>
      )}
      {estimate.confidence === "none" && (
        <p className="text-xs text-muted-foreground mt-1">{confidenceLabel}</p>
      )}
      {detail && (
        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
      )}
    </div>
  );
}

function ConfidenceMeter({
  score,
  level,
}: {
  score: number;
  level: MarketEstimateConfidence;
}) {
  const barColor = confidenceBarClass(level);

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full bg-muted">
        {[0, 1, 2].map((segment) => {
          const filled =
            level === "high" ||
            (level === "medium" && segment <= 1) ||
            (level === "low" && segment === 0);
          return (
            <div
              key={segment}
              className={cn(
                "h-full flex-1 rounded-full transition-colors",
                filled ? barColor : "bg-transparent"
              )}
            />
          );
        })}
      </div>
      <span
        className={cn(
          "text-xs tabular-nums font-medium w-7 text-right",
          confidenceTextClass(level)
        )}
      >
        {score}
      </span>
    </div>
  );
}

function confidenceTextClass(level: MarketEstimateConfidence): string {
  switch (level) {
    case "high":
      return "text-green-600 dark:text-green-500";
    case "medium":
      return "text-amber-600 dark:text-amber-500";
    case "low":
      return "text-red-600 dark:text-red-500";
    default:
      return "text-muted-foreground";
  }
}

function confidenceBarClass(level: MarketEstimateConfidence): string {
  switch (level) {
    case "high":
      return "bg-green-500 dark:bg-green-500";
    case "medium":
      return "bg-amber-500 dark:bg-amber-500";
    case "low":
      return "bg-red-500 dark:bg-red-500";
    default:
      return "bg-muted-foreground/40";
  }
}

function SummaryStat({
  label,
  value,
  subtitle,
  positive,
}: {
  label: string;
  value: string;
  subtitle?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          positive === true && "text-primary",
          positive === false && "text-destructive"
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function formatAsOf(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
