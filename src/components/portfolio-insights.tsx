import {
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  PortfolioInsight,
  PortfolioInsightType,
  PortfolioInsightsResult,
} from "@/types/portfolio-insights";

const INSIGHT_CONFIG: Record<
  PortfolioInsightType,
  { icon: React.ReactNode; label: string; className: string }
> = {
  performance: {
    icon: <TrendingUp className="h-4 w-4" />,
    label: "Performance",
    className: "text-primary",
  },
  risk: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Risk",
    className: "text-amber-600 dark:text-amber-400",
  },
  opportunity: {
    icon: <Lightbulb className="h-4 w-4" />,
    label: "Opportunity",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  action: {
    icon: <Target className="h-4 w-4" />,
    label: "Action",
    className: "text-blue-600 dark:text-blue-400",
  },
};

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PortfolioInsights({
  result,
}: {
  result: PortfolioInsightsResult;
}) {
  const { insights, summary, generatedAt, error } = result;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-medium">
                  Portfolio Insights
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  AI
                </Badge>
              </div>
              <CardDescription className="mt-0.5">
                {summary ??
                  "Personalized observations about your holdings, generated from your portfolio data."}
              </CardDescription>
            </div>
          </div>
          <p className="text-xs text-muted-foreground sm:text-right">
            Updated {formatGeneratedAt(generatedAt)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {error}
          </div>
        ) : null}

        {insights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Insights are unavailable right now. Try again after your next login or
            portfolio update.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight: PortfolioInsight) => {
              const config = INSIGHT_CONFIG[insight.type];
              return (
                <li
                  key={`${insight.type}-${insight.title}`}
                  className="rounded-xl border border-border/80 bg-muted/20 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("shrink-0", config.className)}>
                      {config.icon}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {config.label}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug">
                    {insight.title}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {insight.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
