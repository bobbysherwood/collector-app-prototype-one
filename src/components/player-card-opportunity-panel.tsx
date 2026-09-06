"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Info, Loader2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { getPlayerCardOpportunity } from "@/app/actions/player-opportunity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/types/card";
import type {
  PlayerCardOpportunity,
  PlayerCardRecommendation,
  PlayerOpportunity,
  PlayerOpportunityTrend,
} from "@/types/player-opportunity";
import { cn } from "@/lib/utils";

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function trendLabel(trend: PlayerOpportunityTrend): string {
  return trend.replace(/_/g, " ");
}

function trendClass(trend: PlayerOpportunityTrend): string {
  switch (trend) {
    case "strongly_increasing":
    case "increasing":
      return "text-emerald-600";
    case "declining":
    case "strongly_declining":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function recommendationLabel(rec: PlayerCardRecommendation): string {
  switch (rec) {
    case "strong_buy":
      return "Strong Buy";
    case "buy":
      return "Buy";
    case "hold":
      return "Hold";
    case "sell":
      return "Sell";
    case "strong_sell":
      return "Strong Sell";
  }
}

function recommendationVariant(
  rec: PlayerCardRecommendation
): "default" | "secondary" | "destructive" | "outline" {
  switch (rec) {
    case "strong_buy":
    case "buy":
      return "default";
    case "hold":
      return "secondary";
    case "sell":
    case "strong_sell":
      return "destructive";
  }
}

function scoreStrength(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 60) return "Moderate";
  if (score >= 45) return "Neutral";
  return "Weak";
}

const PLAYER_METRIC_DESCRIPTIONS = {
  opportunityScore:
    "Composite 0–100 score of the player's collectible investment potential, weighted across quality, outlook, demand, sport market, momentum, and catalysts.",
  trend:
    "Direction of expected change in collector demand over the next 90 days, based on momentum signals and catalysts.",
  demand90d:
    "Expected percentage change in player collectible demand over the next 90 days.",
  confidence:
    "How complete the model inputs are. Lower scores mean more missing external data, which reduces reliability.",
  quality:
    "Player quality and legacy profile — career accomplishments, awards, cultural significance, and lifecycle stage.",
  outlook:
    "Forward-looking career or legacy trajectory, adjusted for lifecycle (prospect, active, retired, deceased).",
  demand:
    "Public collector interest — media attention, sentiment, search interest, and discussion growth.",
  sportMarket:
    "Sport-level collectibles market context from the Sport Market Index (health, momentum, outlook).",
  momentum:
    "Combined momentum from sport market conditions and player demand signals.",
} as const;

const CARD_METRIC_DESCRIPTIONS = {
  cardOpportunity:
    "Composite 0–100 score for this specific card at today's price. A strong player score does not automatically produce a strong card score.",
  playerScore:
    "The Player Opportunity score consumed by this model. Player attractiveness is not recalculated here.",
  expectedReturn90d:
    "Forecasted percentage price change for this card over the next 90 days.",
  marginOfSafety:
    "Discount (positive) or premium (negative) versus estimated fair market value. Higher margin of safety means more room for error.",
  currentMarketValue:
    "Latest in-window sale, or the 7-day median when several recent prints exist. Not the first sale in the array.",
  permanentLossRisk:
    "Risk of permanent capital loss from overpaying, illiquidity, population growth, and player risk.",
  playerRisk:
    "Player-level risk from lifecycle, injury, and missing inputs. Separate from card price risk.",
  volatility:
    "How much this card's observed prices have moved recently.",
  uncertainty:
    "How incomplete the inputs are. Higher when confidence is low.",
  fairMarketValue:
    "Estimated fair market value from recent comparable sales and the valuation model.",
  expectedValue90d:
    "Projected market value for this card in 90 days based on the forecast model.",
  valuation:
    "Attractiveness of the current price relative to fair value. Neutral at fair value; higher when underpriced, lower when overpriced.",
  scarcity:
    "Card scarcity profile — population counts, gem rate, serial-number limits, and relative rarity.",
  demand:
    "Card-level collector demand, sentiment, and attention for this specific card.",
  return:
    "Score derived from the expected 90-day return forecast.",
  riskAdjustedReturn:
    "Expected return adjusted downward for player risk, card volatility, and uncertainty.",
  liquidity:
    "How easily this card can be bought or sold, based on sales velocity and market activity.",
  upsideScenario:
    "Optimistic 90-day value scenario — approximately 15% above the base forecast.",
  baseScenario:
    "Expected 90-day value under the base forecast assumptions.",
  downsideScenario:
    "Pessimistic 90-day value scenario — approximately 15% below the base forecast.",
} as const;

function MetricInfoIcon({ description }: { description: string }) {
  return (
    <span className="group/info relative inline-flex shrink-0">
      <Info
        className="h-3.5 w-3.5 cursor-help text-muted-foreground/70 transition-colors hover:text-muted-foreground"
        tabIndex={0}
        aria-label={description}
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/info:opacity-100 group-focus-within/info:opacity-100"
      >
        {description}
      </span>
    </span>
  );
}

function MetricLabel({
  label,
  description,
  uppercase = true,
}: {
  label: string;
  description?: string;
  uppercase?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <p
        className={cn(
          "text-xs text-muted-foreground",
          uppercase && "uppercase tracking-wide"
        )}
      >
        {label}
      </p>
      {description ? <MetricInfoIcon description={description} /> : null}
    </div>
  );
}

function ScoreTile({
  label,
  value,
  suffix,
  valueClassName,
  description,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  valueClassName?: string;
  description?: string;
}) {
  return (
    <div className="overflow-visible rounded-lg border border-border/80 bg-background px-4 py-3">
      <MetricLabel label={label} description={description} />
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", valueClassName)}>
        {value}
        {suffix ? (
          <span className="ml-0.5 text-sm font-normal text-muted-foreground">{suffix}</span>
        ) : null}
      </p>
    </div>
  );
}

function ValueTile({
  label,
  value,
  description,
  valueClassName,
  icon,
}: {
  label: string;
  value: ReactNode;
  description?: string;
  valueClassName?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="overflow-visible rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
      <MetricLabel label={label} description={description} uppercase={false} />
      <p
        className={cn(
          "mt-1 flex items-center gap-1.5 text-lg font-semibold tabular-nums",
          valueClassName
        )}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

function DriverList({
  title,
  items,
  tone = "positive",
}: {
  title: string;
  items: string[];
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border border-border/80 p-4">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None detected.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-start gap-2 text-sm">
              <Badge
                variant={tone === "negative" ? "outline" : "secondary"}
                className="mt-0.5 shrink-0 text-[10px]"
              >
                {tone === "negative" ? "Risk" : "Driver"}
              </Badge>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlayerCardOpportunityPanel({ cardId }: { cardId: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerOpportunity, setPlayerOpportunity] = useState<PlayerOpportunity | null>(null);
  const [cardOpportunity, setCardOpportunity] = useState<PlayerCardOpportunity | null>(null);

  const loadOpportunity = useCallback(async (refresh: boolean) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const response = await getPlayerCardOpportunity(cardId, { persist: !refresh });

    if (refresh) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }

    if (response.error) {
      setError(response.error);
      if (!refresh) {
        setPlayerOpportunity(null);
        setCardOpportunity(null);
      }
      return;
    }

    setPlayerOpportunity(response.playerOpportunity ?? null);
    setCardOpportunity(response.cardOpportunity ?? null);
  }, [cardId]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    getPlayerCardOpportunity(cardId).then((response) => {
      if (cancelled) return;
      setLoading(false);
      if (response.error) {
        setError(response.error);
        return;
      }
      setPlayerOpportunity(response.playerOpportunity ?? null);
      setCardOpportunity(response.cardOpportunity ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const buttonBusy = loading || refreshing;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Investment Opportunity
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Player Opportunity scores collectible demand for the athlete. Player/Card
            Opportunity evaluates whether this specific card is attractive at today&apos;s
            price — a strong player does not automatically mean a strong card buy.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-2"
          disabled={buttonBusy}
          onClick={() => void loadOpportunity(true)}
        >
          {buttonBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Refresh analysis
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Computing opportunity scores…
          </div>
        ) : null}

        {!loading && playerOpportunity && cardOpportunity ? (
          <>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">Player Opportunity</h3>
                <Badge variant="outline" className="text-xs capitalize">
                  {playerOpportunity.lifecycle}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {playerOpportunity.playerName} · {playerOpportunity.modelVersion}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ScoreTile
                  label="Opportunity Score"
                  description={PLAYER_METRIC_DESCRIPTIONS.opportunityScore}
                  value={playerOpportunity.opportunityScore}
                  suffix="/100"
                  valueClassName="text-primary"
                />
                <ScoreTile
                  label="Trend"
                  description={PLAYER_METRIC_DESCRIPTIONS.trend}
                  value={trendLabel(playerOpportunity.trend)}
                  valueClassName={cn("capitalize text-base", trendClass(playerOpportunity.trend))}
                />
                <ScoreTile
                  label="90-Day Demand"
                  description={PLAYER_METRIC_DESCRIPTIONS.demand90d}
                  value={formatPct(playerOpportunity.expectedDemandChange90d)}
                />
                <ScoreTile
                  label="Confidence"
                  description={PLAYER_METRIC_DESCRIPTIONS.confidence}
                  value={playerOpportunity.confidenceScore}
                  suffix="/100"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <ScoreTile
                  label="Quality"
                  description={PLAYER_METRIC_DESCRIPTIONS.quality}
                  value={playerOpportunity.qualityScore}
                />
                <ScoreTile
                  label="Outlook"
                  description={PLAYER_METRIC_DESCRIPTIONS.outlook}
                  value={playerOpportunity.futureOutlookScore}
                />
                <ScoreTile
                  label="Demand"
                  description={PLAYER_METRIC_DESCRIPTIONS.demand}
                  value={playerOpportunity.demandScore}
                />
                <ScoreTile
                  label="Sport Market"
                  description={PLAYER_METRIC_DESCRIPTIONS.sportMarket}
                  value={playerOpportunity.sportMarketScore}
                />
                <ScoreTile
                  label="Momentum"
                  description={PLAYER_METRIC_DESCRIPTIONS.momentum}
                  value={playerOpportunity.momentumScore}
                />
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                <p className="text-sm">{playerOpportunity.summary}</p>
              </div>
            </section>

            <section className="space-y-4 border-t border-border/80 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">Player/Card Opportunity</h3>
                  <Badge variant={recommendationVariant(cardOpportunity.recommendation)}>
                    {recommendationLabel(cardOpportunity.recommendation)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {scoreStrength(cardOpportunity.opportunityScore)} ·{" "}
                    {cardOpportunity.modelVersion}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  As of {new Date(cardOpportunity.computedAt).toLocaleString()}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ScoreTile
                  label="Card Opportunity"
                  description={CARD_METRIC_DESCRIPTIONS.cardOpportunity}
                  value={cardOpportunity.opportunityScore}
                  suffix="/100"
                  valueClassName="text-primary"
                />
                <ScoreTile
                  label="Player Score"
                  description={CARD_METRIC_DESCRIPTIONS.playerScore}
                  value={cardOpportunity.playerOpportunityScore}
                  suffix="/100"
                />
                <ScoreTile
                  label="Expected 90d Return"
                  description={CARD_METRIC_DESCRIPTIONS.expectedReturn90d}
                  value={formatPct(cardOpportunity.expectedReturn90d)}
                  valueClassName={
                    cardOpportunity.expectedReturn90d >= 0
                      ? "text-emerald-600"
                      : "text-destructive"
                  }
                />
                <ScoreTile
                  label="Margin of Safety"
                  description={CARD_METRIC_DESCRIPTIONS.marginOfSafety}
                  value={formatPct(cardOpportunity.marginOfSafety)}
                  valueClassName={
                    cardOpportunity.marginOfSafety >= 0
                      ? "text-emerald-600"
                      : "text-destructive"
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ValueTile
                  label="Current Market Value"
                  description={CARD_METRIC_DESCRIPTIONS.currentMarketValue}
                  value={formatCurrency(cardOpportunity.currentMarketValue)}
                />
                <ValueTile
                  label="Fair Market Value"
                  description={CARD_METRIC_DESCRIPTIONS.fairMarketValue}
                  value={formatCurrency(cardOpportunity.fairMarketValue)}
                />
                <ValueTile
                  label="Expected Value (90d)"
                  description={CARD_METRIC_DESCRIPTIONS.expectedValue90d}
                  value={formatCurrency(cardOpportunity.expectedValue90d)}
                  icon={
                    cardOpportunity.expectedReturn90d >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <ScoreTile
                  label="Valuation"
                  description={CARD_METRIC_DESCRIPTIONS.valuation}
                  value={cardOpportunity.valuationScore}
                />
                <ScoreTile
                  label="Scarcity"
                  description={CARD_METRIC_DESCRIPTIONS.scarcity}
                  value={cardOpportunity.scarcityScore}
                />
                <ScoreTile
                  label="Demand"
                  description={CARD_METRIC_DESCRIPTIONS.demand}
                  value={cardOpportunity.demandScore}
                />
                <ScoreTile
                  label="Return"
                  description={CARD_METRIC_DESCRIPTIONS.return}
                  value={cardOpportunity.returnScore}
                />
                <ScoreTile
                  label="Risk-Adj. Return"
                  description={CARD_METRIC_DESCRIPTIONS.riskAdjustedReturn}
                  value={cardOpportunity.riskAdjustedReturnScore}
                />
                <ScoreTile
                  label="Liquidity"
                  description={CARD_METRIC_DESCRIPTIONS.liquidity}
                  value={cardOpportunity.liquidityScore}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ScoreTile
                  label="Permanent-loss risk"
                  description={CARD_METRIC_DESCRIPTIONS.permanentLossRisk}
                  value={cardOpportunity.riskScore}
                />
                <ScoreTile
                  label="Player risk"
                  description={CARD_METRIC_DESCRIPTIONS.playerRisk}
                  value={cardOpportunity.playerRiskScore}
                />
                <ScoreTile
                  label="Volatility"
                  description={CARD_METRIC_DESCRIPTIONS.volatility}
                  value={cardOpportunity.volatilityScore}
                />
                <ScoreTile
                  label="Uncertainty"
                  description={CARD_METRIC_DESCRIPTIONS.uncertainty}
                  value={cardOpportunity.uncertaintyScore}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ValueTile
                  label="Upside scenario"
                  description={CARD_METRIC_DESCRIPTIONS.upsideScenario}
                  value={formatCurrency(cardOpportunity.upsideScenario)}
                  valueClassName="text-base"
                />
                <ValueTile
                  label="Base scenario"
                  description={CARD_METRIC_DESCRIPTIONS.baseScenario}
                  value={formatCurrency(cardOpportunity.baseScenario)}
                  valueClassName="text-base"
                />
                <ValueTile
                  label="Downside scenario"
                  description={CARD_METRIC_DESCRIPTIONS.downsideScenario}
                  value={formatCurrency(cardOpportunity.downsideScenario)}
                  valueClassName="text-base"
                />
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                <p className="text-sm">{cardOpportunity.summary}</p>
              </div>

              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-border/80 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-medium">Drivers & risks</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <DriverList
                      title="Positive drivers"
                      items={[
                        ...playerOpportunity.positiveDrivers,
                        ...cardOpportunity.positiveDrivers.filter(
                          (d) => !playerOpportunity.positiveDrivers.includes(d)
                        ),
                      ]}
                    />
                    <DriverList
                      title="Risks & headwinds"
                      items={[
                        ...playerOpportunity.negativeDrivers,
                        ...cardOpportunity.negativeDrivers.filter(
                          (d) => !playerOpportunity.negativeDrivers.includes(d)
                        ),
                      ]}
                      tone="negative"
                    />
                  </div>

                  {playerOpportunity.catalysts.length > 0 ? (
                    <div className="rounded-lg border border-border/80 p-4">
                      <p className="mb-2 text-sm font-medium">Catalysts</p>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {playerOpportunity.catalysts.map((catalyst) => (
                          <li key={catalyst.id}>
                            {catalyst.label}
                            <span className="ml-2 text-xs capitalize text-foreground/70">
                              ({catalyst.direction}, {catalyst.expectedDurationDays}d)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
