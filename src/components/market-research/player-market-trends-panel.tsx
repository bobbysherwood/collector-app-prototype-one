"use client";

import Link from "next/link";
import type { PlayerResearchPageData } from "@/lib/market-research/load-pages";
import type { ResearchChartRange } from "@/lib/market-research/series";
import {
  formatSignedPct,
  riskLabel,
  scoreLabel,
  scoreTone,
} from "@/lib/market-research/signals";
import { formatCurrency } from "@/types/card";
import {
  ResearchEmptyState,
  ResearchLineChart,
  ResearchMetricCard,
  ResearchPanel,
  ResearchRangeToggle,
} from "@/components/market-research/research-shared";

export function PlayerMarketTrendsPanel({
  data,
  range,
  onRangeChange,
}: {
  data: PlayerResearchPageData;
  range: ResearchChartRange;
  onRangeChange: (range: ResearchChartRange) => void;
}) {
  const opportunity = data.playerOpportunity;
  const trends = data.marketTrends;
  const index = trends?.sportIndex ?? null;
  const risk = riskLabel(opportunity?.riskScore ?? index?.riskRating ?? "medium");

  if (!trends) {
    return (
      <ResearchPanel title="Market Trends">
        <ResearchEmptyState>
          Market trend inputs are not available for this player yet.
        </ResearchEmptyState>
      </ResearchPanel>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <ResearchMetricCard
          label="Opportunity"
          value={opportunity ? `${opportunity.opportunityScore}` : "—"}
          detail={opportunity ? scoreLabel(opportunity.opportunityScore) : "Not scored"}
          tone={opportunity ? scoreTone(opportunity.opportunityScore) : "neutral"}
        />
        <ResearchMetricCard
          label="Demand"
          value={opportunity ? `${opportunity.demandScore}` : "—"}
          detail={opportunity ? scoreLabel(opportunity.demandScore) : undefined}
          tone={opportunity ? scoreTone(opportunity.demandScore) : "neutral"}
        />
        <ResearchMetricCard
          label="Quality"
          value={opportunity ? `${opportunity.qualityScore}` : "—"}
          detail={opportunity ? scoreLabel(opportunity.qualityScore) : undefined}
          tone={opportunity ? scoreTone(opportunity.qualityScore) : "neutral"}
        />
        <ResearchMetricCard
          label="Risk"
          value={risk.label}
          detail={opportunity ? `${opportunity.riskScore} / 100` : undefined}
          tone={risk.tone}
        />
        <ResearchMetricCard
          label="Sport Index"
          value={index ? `${index.healthScore}` : "—"}
          detail={index ? scoreLabel(index.healthScore) : "No snapshot"}
          tone={index ? scoreTone(index.healthScore) : "neutral"}
        />
        <ResearchMetricCard
          label="90-Day Outlook"
          value={
            opportunity
              ? formatSignedPct(opportunity.expectedDemandChange90d)
              : index
                ? formatSignedPct(index.forecast3mPct)
                : "—"
          }
          detail="Model forecast"
          tone={
            (opportunity?.expectedDemandChange90d ?? index?.forecast3mPct ?? 0) >= 0
              ? "positive"
              : "negative"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ResearchPanel
          title="Player Opportunity Trend"
          action={<ResearchRangeToggle value={range} onChange={onRangeChange} />}
        >
          {trends.opportunitySeries.length > 0 ? (
            <>
              <ResearchLineChart
                points={trends.opportunitySeries}
                range={range}
                color="#059669"
                currentValue={opportunity?.opportunityScore}
                yDomain={[0, 100]}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {trends.snapshotCount > 1
                  ? `${trends.snapshotCount} stored snapshots. A new row is written at most every 12 hours.`
                  : "History starts from the current score. Additional snapshots accumulate as this page is scored over time."}
              </p>
            </>
          ) : (
            <ResearchEmptyState>
              Opportunity trend appears after the player can be scored.
            </ResearchEmptyState>
          )}
        </ResearchPanel>
        <ResearchPanel
          title="Sport Market Index"
          action={
            <Link
              href={trends.sportIndexHref}
              className="text-xs font-medium text-primary"
            >
              View market →
            </Link>
          }
        >
          {trends.sportIndexSeries.length > 0 ? (
            <>
              <ResearchLineChart
                points={trends.sportIndexSeries}
                range={range}
                color="#2563eb"
                currentValue={index?.healthScore}
                yDomain={[0, 100]}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Current {data.sportLabel} index plus implied 30-day move and 90-day
                forecast.
              </p>
            </>
          ) : (
            <ResearchEmptyState>
              No Sport Market Index is available for this sport yet.
            </ResearchEmptyState>
          )}
        </ResearchPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ResearchPanel
          title="Card Comps (Median Sale)"
          action={<ResearchRangeToggle value={range} onChange={onRangeChange} />}
        >
          {trends.comps.priceSeries.length > 0 ? (
            <>
              <ResearchLineChart
                points={trends.comps.priceSeries}
                range={range}
                color="#0f766e"
                currentValue={
                  trends.comps.lastSale
                    ? Math.round(trends.comps.lastSale.price)
                    : undefined
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {trends.comps.sourceNote}
              </p>
            </>
          ) : (
            <ResearchEmptyState>{trends.comps.sourceNote}</ResearchEmptyState>
          )}
        </ResearchPanel>
        <ResearchPanel title="Sales Activity">
          {trends.comps.saleCount > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Sales</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {trends.comps.saleCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Volume</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {formatCurrency(trends.comps.volume)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Median</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {trends.comps.medianPrice != null
                      ? formatCurrency(trends.comps.medianPrice)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cards in tape</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {trends.comps.cardCount.toLocaleString()}
                  </div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Card</th>
                    <th className="pb-2 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.comps.recentSales.map((sale, index) => (
                    <tr
                      key={`${sale.href}-${sale.date}-${index}`}
                      className="border-t border-border/60"
                    >
                      <td className="py-2 whitespace-nowrap">{sale.date}</td>
                      <td className="py-2">
                        <Link
                          href={sale.href}
                          className="block max-w-[180px] truncate hover:text-primary"
                        >
                          {sale.cardName}
                        </Link>
                      </td>
                      <td className="py-2 tabular-nums">
                        {formatCurrency(sale.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResearchEmptyState>
              Link catalog cards to this player to populate comps.
            </ResearchEmptyState>
          )}
        </ResearchPanel>
      </div>
    </>
  );
}
