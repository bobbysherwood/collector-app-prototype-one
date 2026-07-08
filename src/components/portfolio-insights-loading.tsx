import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PortfolioInsightsLoading() {
  return (
    <Card>
      <CardHeader>
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
              Generating personalized observations from your portfolio data…
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading insights…
        </div>
      </CardContent>
    </Card>
  );
}
