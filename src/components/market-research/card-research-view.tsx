"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { CardResearchPageData } from "@/lib/market-research/load-pages";
import {
  formatSignedPct,
  recommendationCopy,
  scoreLabel,
} from "@/lib/market-research/signals";
import type { ResearchChartRange } from "@/lib/market-research/series";
import { formatCurrency } from "@/types/card";
import { MARKET_SALE_TYPE_LABELS } from "@/types/market-sales";
import {
  ResearchBreadcrumbs,
  ResearchEmptyState,
  ResearchHeaderActions,
  ResearchLineChart,
  ResearchMetricCard,
  ResearchPanel,
  ResearchRangeToggle,
  ResearchRecommendation,
  ResearchScoreGauge,
  ResearchScoreRow,
  ResearchThesis,
  ResearchUnavailableNote,
} from "@/components/market-research/research-shared";

const CARD_TABS = [
  "overview",
  "sales-history",
  "listings",
  "price-chart",
  "comparables",
  "ai-analysis",
] as const;

export function CardResearchView({ data }: { data: CardResearchPageData }) {
  const [range, setRange] = useState<ResearchChartRange>("1Y");
  const opportunity = data.cardOpportunity;
  const recommendation = opportunity
    ? recommendationCopy(opportunity.recommendation)
    : null;
  const change90d = opportunity?.expectedReturn90d;

  const metadata = [
    data.card.manufacturerName,
    data.card.brandName,
    String(data.card.year),
    data.card.parallelName,
    data.card.cardNumber ? `#${data.card.cardNumber}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <ResearchBreadcrumbs
            items={[
              { label: "Market Research", href: "/market-research" },
              { label: "Cards", href: "/market-research" },
              { label: data.title },
            ]}
          />
          <div className="flex gap-4">
            <div className="relative aspect-[2.5/3.5] w-24 overflow-hidden rounded-xl border bg-muted sm:w-32">
              {data.imageUrl ? (
                <Image
                  src={data.imageUrl}
                  alt={data.title}
                  fill
                  className="object-contain p-1"
                  sizes="128px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl font-semibold text-muted-foreground/30">
                  {data.card.player.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
              <p className="mt-1 text-sm">
                <Link href={data.playerHref} className="text-primary hover:underline">
                  {data.card.player}
                </Link>
                {" · "}
                <Link href={data.marketHref} className="text-muted-foreground hover:text-foreground">
                  {data.card.sportName}
                </Link>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {metadata.map((item) => (
                  <Badge key={item} variant="secondary" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        <ResearchHeaderActions
          kind="card"
          id={data.card.id}
          label={data.title}
          href={`/market-research/cards/${data.card.id}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResearchMetricCard
          label="Estimated Value"
          value={
            data.estimatedValue != null ? formatCurrency(data.estimatedValue) : "—"
          }
          detail={
            change90d != null ? `${formatSignedPct(change90d)} (90 Days)` : undefined
          }
          tone={change90d != null && change90d >= 0 ? "positive" : "neutral"}
        />
        <ResearchMetricCard
          label="90-Day Forecast"
          value={change90d != null ? formatSignedPct(change90d) : "—"}
          detail="Projected Return"
          tone={change90d != null && change90d >= 0 ? "positive" : "caution"}
        />
        {recommendation ? (
          <ResearchRecommendation
            label={recommendation.label}
            qualifier={recommendation.qualifier}
            tone={recommendation.tone}
          />
        ) : (
          <ResearchMetricCard
            label="Recommendation"
            value="—"
            detail="Needs Card Opportunity score"
          />
        )}
        <div className="rounded-2xl border border-border/70 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Card Opportunity Score
          </div>
          <div className="mt-1 flex items-center gap-3">
            <ResearchScoreGauge score={opportunity?.opportunityScore ?? 0} size={72} />
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {opportunity ? `${opportunity.opportunityScore} / 100` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {opportunity
                  ? `${scoreLabel(opportunity.opportunityScore)} Opportunity`
                  : "Not scored"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 text-sm">
        <SummaryStat
          label="Last Sale"
          value={
            data.lastSale ? formatCurrency(data.lastSale.sale_price) : "—"
          }
          detail={data.lastSale ? data.lastSale.sale_date : undefined}
        />
        <SummaryStat
          label="Recent Sales"
          value={String(data.sales.length)}
          detail="Completed comps"
        />
        <SummaryStat
          label="Current Listings"
          value={String(data.listingStats.count)}
          detail="Active eBay asks"
        />
        <SummaryStat
          label="Avg. Ask Price"
          value={
            data.listingStats.average != null
              ? formatCurrency(data.listingStats.average)
              : "—"
          }
        />
        <SummaryStat
          label="Population"
          value="—"
          detail="PSA population not connected"
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {CARD_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab.replace("-", " ")}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <ResearchPanel
              title="Price History"
              action={<ResearchRangeToggle value={range} onChange={setRange} />}
            >
              <ResearchLineChart
                points={data.priceSeries}
                range={range}
                color="#059669"
                currentValue={data.estimatedValue ?? undefined}
              />
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  Current Value{" "}
                  <span className="font-semibold tabular-nums">
                    {data.estimatedValue != null
                      ? formatCurrency(data.estimatedValue)
                      : "—"}
                  </span>
                </div>
                <div>
                  90-Day Forecast{" "}
                  <span className="font-semibold tabular-nums text-emerald-600">
                    {opportunity
                      ? `${formatCurrency(opportunity.expectedValue90d)} (${formatSignedPct(opportunity.expectedReturn90d)})`
                      : "—"}
                  </span>
                </div>
              </div>
            </ResearchPanel>

            <ResearchPanel
              title="eBay Sales (Recent)"
              action={
                <a href="#sales-history" className="text-xs font-medium text-primary">
                  View All Sales →
                </a>
              }
            >
              {data.sales.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Price</th>
                      <th className="pb-2 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.slice(0, 6).map((sale) => (
                      <tr key={sale.id} className="border-t border-border/60">
                        <td className="py-2">{sale.sale_date}</td>
                        <td className="py-2 tabular-nums">
                          {formatCurrency(sale.sale_price)}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {MARKET_SALE_TYPE_LABELS[sale.sale_type]}
                          {sale.grade ? ` · ${sale.grade}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <ResearchEmptyState>No completed comps available.</ResearchEmptyState>
              )}
              <div className="mt-3">
                <ResearchUnavailableNote>
                  Completed sales currently use the market-sales mock comps pipeline.
                  Live eBay data is used for active listings.
                </ResearchUnavailableNote>
              </div>
            </ResearchPanel>

            <ResearchPanel title="Current Listings (eBay)">
              {data.listingStats.count > 0 ? (
                <div className="space-y-2 text-sm">
                  <div>
                    Price Range{" "}
                    <span className="font-semibold tabular-nums">
                      {data.listingStats.min != null && data.listingStats.max != null
                        ? `${formatCurrency(data.listingStats.min)} - ${formatCurrency(data.listingStats.max)}`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    Total Listings{" "}
                    <span className="font-semibold">{data.listingStats.count}</span>
                  </div>
                  <div>
                    Avg. Ask Price{" "}
                    <span className="font-semibold tabular-nums">
                      {data.listingStats.average != null
                        ? formatCurrency(data.listingStats.average)
                        : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Asking prices are not completed sales.
                  </p>
                </div>
              ) : (
                <ResearchEmptyState>
                  {data.listingsError ?? "No matching eBay listings were returned."}
                </ResearchEmptyState>
              )}
            </ResearchPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ResearchPanel title="Population & Scarcity">
              <ResearchUnavailableNote>
                PSA population, gem rate, and pop rank are not connected. Scarcity in
                the Card Opportunity model currently uses catalog metadata such as
                parallel, numbering, and rookie/auto signals.
              </ResearchUnavailableNote>
              {opportunity ? (
                <div className="mt-3">
                  <ResearchScoreRow label="Model Scarcity" score={opportunity.scarcityScore} />
                  <ResearchScoreRow label="Liquidity" score={opportunity.liquidityScore} />
                </div>
              ) : null}
            </ResearchPanel>
            <ResearchPanel title="AI Model Summary">
              {opportunity && data.playerOpportunity ? (
                <div>
                  <ResearchScoreRow
                    label="Player Opportunity"
                    score={data.playerOpportunity.opportunityScore}
                  />
                  <ResearchScoreRow label="Market Demand" score={opportunity.demandScore} />
                  <ResearchScoreRow label="Scarcity" score={opportunity.scarcityScore} />
                  <ResearchScoreRow label="Liquidity" score={opportunity.liquidityScore} />
                  <ResearchScoreRow label="Permanent-loss risk" score={opportunity.riskScore} />
                  <ResearchScoreRow label="Player risk" score={opportunity.playerRiskScore} />
                  <ResearchScoreRow label="Volatility" score={opportunity.volatilityScore} />
                  <ResearchScoreRow label="Uncertainty" score={opportunity.uncertaintyScore} />
                  <div className="mt-3">
                    <ResearchThesis
                      text={opportunity.summary}
                      href="#ai-analysis"
                      hrefLabel="View Full AI Analysis →"
                    />
                  </div>
                </div>
              ) : (
                <ResearchEmptyState>
                  Card Opportunity has not been computed for this catalog card.
                </ResearchEmptyState>
              )}
            </ResearchPanel>
          </div>
        </TabsContent>

        <TabsContent value="sales-history" className="mt-4">
          <ResearchPanel title="Sales History">
            {data.sales.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Price</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.map((sale) => (
                    <tr key={sale.id} className="border-t border-border/60">
                      <td className="py-2">{sale.sale_date}</td>
                      <td className="py-2 tabular-nums">
                        {formatCurrency(sale.sale_price)}
                      </td>
                      <td className="py-2">{MARKET_SALE_TYPE_LABELS[sale.sale_type]}</td>
                      <td className="py-2">{sale.grade ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ResearchEmptyState>No completed comps available.</ResearchEmptyState>
            )}
          </ResearchPanel>
        </TabsContent>

        <TabsContent value="listings" className="mt-4">
          <ResearchPanel title="Listings">
            {data.listings.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">Ask</th>
                    <th className="pb-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {data.listings.slice(0, 12).map((listing) => (
                    <tr key={listing.id} className="border-t border-border/60">
                      <td className="py-2">
                        <a
                          href={listing.listing_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {listing.title}
                        </a>
                      </td>
                      <td className="py-2 tabular-nums">
                        {formatCurrency(listing.price)}
                      </td>
                      <td className="py-2 capitalize">
                        {listing.listing_type.replaceAll("_", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ResearchEmptyState>
                {data.listingsError ?? "No active listings matched this card."}
              </ResearchEmptyState>
            )}
          </ResearchPanel>
        </TabsContent>

        <TabsContent value="price-chart" className="mt-4">
          <ResearchPanel
            title="Price Chart"
            action={<ResearchRangeToggle value={range} onChange={setRange} />}
          >
            <ResearchLineChart
              points={data.priceSeries}
              range={range}
              color="#059669"
              currentValue={data.estimatedValue ?? undefined}
            />
          </ResearchPanel>
        </TabsContent>

        <TabsContent value="comparables" className="mt-4">
          <ResearchPanel title="Comparables">
            <ResearchUnavailableNote>
              Comparable card sets will use catalog siblings and sale comps once a
              dedicated comparable engine is added.
            </ResearchUnavailableNote>
          </ResearchPanel>
        </TabsContent>

        <TabsContent value="ai-analysis" className="mt-4">
          <ResearchPanel title="AI Analysis">
            {opportunity ? (
              <div className="space-y-4">
                <ResearchThesis text={opportunity.summary} />
                <div>
                  <ResearchScoreRow label="Valuation" score={opportunity.valuationScore} />
                  <ResearchScoreRow label="Scarcity" score={opportunity.scarcityScore} />
                  <ResearchScoreRow label="Demand" score={opportunity.demandScore} />
                  <ResearchScoreRow label="Expected Return" score={opportunity.returnScore} />
                  <ResearchScoreRow label="Liquidity" score={opportunity.liquidityScore} />
                  <ResearchScoreRow
                    label="Risk-Adjusted Return"
                    score={opportunity.riskAdjustedReturnScore}
                  />
                </div>
              </div>
            ) : (
              <ResearchEmptyState>
                Card Opportunity analysis is not available for this card.
              </ResearchEmptyState>
            )}
          </ResearchPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold tabular-nums">{value}</div>
      {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
