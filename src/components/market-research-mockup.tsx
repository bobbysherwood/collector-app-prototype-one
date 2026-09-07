"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketResearchSearchPanel } from "@/components/market-research-search-panel";
import type { MarketResearchSearchSelection } from "@/types/data-model-v2";

export function MarketResearchMockup({
  activeTab,
}: {
  activeTab: "card" | "player" | "sport";
}) {
  const [selection, setSelection] = useState<MarketResearchSearchSelection | null>(
    null
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Market Research</h1>
            <Badge variant="outline" className="text-xs">
              Prototype
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Research sports, players, and cards to identify investment opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <Bell className="h-4 w-4" />
            Alerts
          </Button>
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <Bookmark className="h-4 w-4" />
            Watchlists
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/market-research/markets/nba" />} nativeButton={false} variant="outline" size="sm">
          NBA Market
        </Button>
        <Button render={<Link href="/market-research/markets/nfl" />} nativeButton={false} variant="outline" size="sm">
          NFL Market
        </Button>
        <Button render={<Link href="/market-research/markets/mlb" />} nativeButton={false} variant="outline" size="sm">
          MLB Market
        </Button>
      </div>

      <MarketResearchSearchPanel
        activeTab={activeTab}
        selection={selection}
        onSelectionChange={setSelection}
      />
    </div>
  );
}
