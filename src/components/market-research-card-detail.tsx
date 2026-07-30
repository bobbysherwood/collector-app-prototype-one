"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { getMarketResearchCardMarketData } from "@/app/actions/market-research";
import type { MarketResearchCardMarketData } from "@/app/actions/market-research";
import { formatDm2CardResearchTitle } from "@/components/dm2-card-search-input";
import { Dm2CardAttributeBadges } from "@/components/dm2-card-attribute-badges";
import { MarketSalesSection } from "@/components/market-sales-section";
import { MarketSentimentAnalysisPanel } from "@/components/market-sentiment-analysis-panel";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getDm2CardImageUrl } from "@/lib/images";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

interface MarketResearchCardDetailProps {
  card: Dm2CardSearchResult;
}

export function MarketResearchCardDetail({ card }: MarketResearchCardDetailProps) {
  const imageUrl = getDm2CardImageUrl(card.imagePath);
  const [loading, setLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketResearchCardMarketData | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setMarketData(null);

    getMarketResearchCardMarketData(card).then((result) => {
      if (cancelled) return;
      setMarketData(result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [card.id]);

  return (
    <div className="space-y-6">
      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="relative mx-auto aspect-[2.5/3.5] w-full max-w-[320px] overflow-hidden rounded-xl border border-border bg-muted lg:mx-0">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={formatDm2CardResearchTitle(card)}
              fill
              className="object-contain p-3"
              priority
              sizes="320px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-6xl font-bold text-muted-foreground/20">
                {card.player.charAt(0)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {formatDm2CardResearchTitle(card)}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {card.sportName}
              {card.cardNumber ? ` · #${card.cardNumber}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{card.brandName}</Badge>
            <Badge variant="outline">{card.cardSetName}</Badge>
            {card.parallelName ? (
              <Badge variant="outline">{card.parallelName}</Badge>
            ) : null}
          </div>

          <Dm2CardAttributeBadges names={card.attributeNames} />

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Year" value={String(card.year)} />
            <DetailField label="Sport" value={card.sportName} />
            <DetailField label="Manufacturer" value={card.manufacturerName} />
            <DetailField label="Brand" value={card.brandName} />
            <DetailField label="Set Category" value={card.cardSetCategoryName} />
            <DetailField label="Set Name" value={card.cardSetName} />
            {card.cardNumber ? (
              <DetailField label="Card Number" value={card.cardNumber} />
            ) : null}
            {card.parallelName ? (
              <DetailField label="Parallel" value={card.parallelName} />
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-4 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading market sales and listings…
        </div>
      ) : marketData ? (
        <>
          <MarketSentimentAnalysisPanel card={card} />
          <MarketSalesSection
            asset={marketData.asset}
            lots={[]}
            data={marketData.marketSales}
            predictions={marketData.predictions}
            ebayListings={marketData.ebayListings}
            listingsAsOf={marketData.listingsAsOf}
            listingsError={marketData.listingsError}
            ebaySandboxMode={marketData.ebaySandboxMode}
          />
        </>
      ) : null}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
