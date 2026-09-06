"use client";

import { useState } from "react";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { sportBallImageUrl } from "@/lib/market-research/catalog";
import type { SportMarketPageData } from "@/lib/market-research/load-pages";
import { formatSignedPct, riskLabel, scoreLabel, scoreTone, volatilityLabel } from "@/lib/market-research/signals";
import type { ResearchChartRange } from "@/lib/market-research/series";
import { formatCurrency } from "@/types/card";
import {
  ResearchBreadcrumbs,
  ResearchCardList,
  ResearchDriverBar,
  ResearchEmptyState,
  ResearchForecastChart,
  ResearchHeaderActions,
  ResearchLineChart,
  ResearchMetricCard,
  ResearchPanel,
  ResearchPlayerList,
  ResearchRangeToggle,
  ResearchUnavailableNote,
} from "@/components/market-research/research-shared";

export function SportMarketView({ data }: { data: SportMarketPageData }) {
  const [range, setRange] = useState<ResearchChartRange>("1Y");
  const ballImageUrl = sportBallImageUrl(data.sport);
  const index = data.index;
  const risk = riskLabel(index?.riskRating ?? "medium");
  const volatility = volatilityLabel(
    index ? Math.max(8, 28 - index.confidenceScore * 0.15) : 20
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <ResearchBreadcrumbs
            items={[
              { label: "Market Research", href: "/market-research" },
              { label: "Market" },
              { label: data.sport.name },
            ]}
          />
          <div className="flex items-center gap-3">
            {ballImageUrl ? (
              <div className="relative size-12 overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={ballImageUrl}
                  alt={
                    data.sport.sportLabel === "Hockey"
                      ? "Hockey puck"
                      : `${data.sport.sportLabel} ball`
                  }
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            ) : (
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Trophy className="h-6 w-6" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{data.sport.name}</h1>
              <p className="text-sm text-muted-foreground">Sport Market Overview</p>
            </div>
          </div>
        </div>
        <ResearchHeaderActions
          kind="market"
          id={data.sport.slug}
          label={data.sport.name}
          href={`/market-research/markets/${data.sport.slug}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <ResearchMetricCard
          label="Market Index"
          value={index ? `${index.healthScore} / 100` : "—"}
          detail={index ? scoreLabel(index.healthScore) : "No snapshot"}
          tone={index ? scoreTone(index.healthScore) : "neutral"}
        />
        <ResearchMetricCard
          label="Market Momentum"
          value={index ? formatSignedPct(index.forecast3mPct) : "—"}
          detail="90 Days"
          tone={index && index.forecast3mPct >= 0 ? "positive" : "negative"}
        />
        <ResearchMetricCard
          label="Demand"
          value={index ? `${index.outlookScore} / 100` : "—"}
          detail={index ? scoreLabel(index.outlookScore) : undefined}
          tone={index ? scoreTone(index.outlookScore) : "neutral"}
        />
        <ResearchMetricCard
          label="Liquidity"
          value={index ? `${index.momentumScore} / 100` : "—"}
          detail={index ? scoreLabel(index.momentumScore) : undefined}
          tone={index ? scoreTone(index.momentumScore) : "neutral"}
        />
        <ResearchMetricCard
          label="Volatility"
          value={volatility.label}
          detail={
            index
              ? `${(28 - index.confidenceScore * 0.15).toFixed(1)}% (model)`
              : undefined
          }
          tone={volatility.tone}
        />
        <ResearchMetricCard
          label="Risk"
          value={risk.label}
          detail={`${risk.score} / 10`}
          tone={risk.tone}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <ResearchPanel
          title="Sport Market Index"
          action={<ResearchRangeToggle value={range} onChange={setRange} />}
        >
          {index ? (
            <>
              <ResearchLineChart
                points={data.indexSeries}
                range={range}
                currentValue={index.healthScore}
                yDomain={[0, 100]}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Current index plus implied 30-day move and 90-day model forecast from the
                latest snapshot. Historical ticks appear as more snapshots are stored.
              </p>
            </>
          ) : (
            <ResearchEmptyState>
              {data.indexError ??
                "No Sport Market Index has been computed for this sport yet. An admin can refresh it from AI Indexes."}
            </ResearchEmptyState>
          )}
        </ResearchPanel>

        <ResearchPanel title="90-Day Forecast">
          {index ? (
            <div className="space-y-3">
              <div>
                <div className="text-3xl font-semibold text-emerald-600 tabular-nums">
                  {formatSignedPct(index.forecast3mPct)}
                </div>
                <div className="text-sm text-muted-foreground">Projected Change</div>
              </div>
              <ResearchForecastChart points={data.forecastSeries} />
              <p className="text-xs text-emerald-700">
                Model forecast {formatSignedPct(index.forecast3mPct)} over 90 days
                {index.forecast6mPct != null
                  ? ` · 6M ${formatSignedPct(index.forecast6mPct)}`
                  : ""}
              </p>
            </div>
          ) : (
            <ResearchEmptyState>Forecast requires a computed sport index.</ResearchEmptyState>
          )}
        </ResearchPanel>
      </div>

      <ResearchPanel title="Market Drivers">
        {data.drivers.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
            {data.drivers.map((driver) => (
              <ResearchDriverBar
                key={driver.key}
                label={driver.label}
                score={driver.score}
                signal={driver.signal}
                explanation={driver.explanation}
              />
            ))}
          </div>
        ) : (
          <ResearchEmptyState>
            Driver breakdown appears after a Sport Market Index snapshot is available.
          </ResearchEmptyState>
        )}
      </ResearchPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <ResearchPanel title="Top Rising Players">
          <ResearchPlayerList players={data.risingPlayers} />
        </ResearchPanel>
        <ResearchPanel
          title="Top Card Opportunities"
          action={
            <a href="/market-research" className="text-xs font-medium text-primary">
              View all
            </a>
          }
        >
          <ResearchCardList cards={data.topCards} />
        </ResearchPanel>
        <ResearchPanel title="Recent Sales Activity">
          {data.salesActivity ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total Sales Volume
                </div>
                <div className="mt-1 flex items-end gap-2">
                  <div className="text-2xl font-semibold tabular-nums">
                    {data.salesActivity.volume > 0
                      ? formatCurrency(data.salesActivity.volume)
                      : "—"}
                  </div>
                  {data.salesActivity.volume > 0 &&
                  data.salesActivity.volumeChangePct != null ? (
                    <div className="text-sm font-medium text-emerald-600">
                      {formatSignedPct(data.salesActivity.volumeChangePct)}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {data.salesActivity.saleCount.toLocaleString()} sales
                {data.salesActivity.saleCountChangePct != null
                  ? ` · ${formatSignedPct(data.salesActivity.saleCountChangePct)}`
                  : ""}
              </div>
              <ResearchUnavailableNote>
                {data.salesActivity.sourceNote}. Completed eBay sales are still mock comps
                except where listings are live.
              </ResearchUnavailableNote>
            </div>
          ) : (
            <ResearchEmptyState>No sales activity is available for this sport yet.</ResearchEmptyState>
          )}
        </ResearchPanel>
      </div>
    </div>
  );
}
