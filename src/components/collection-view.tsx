"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardList } from "@/components/card-list";
import type { CardValuation } from "@/types/card";
import { gradeLabel, groupHeldLotsByIdentity } from "@/types/card";
import type { CardSale } from "@/types/card";
import { salesForAsset, type AssetPosition, type HeldLotPosition } from "@/types/card";
import { Search } from "lucide-react";

interface CollectionViewProps {
  heldLotPositions: HeldLotPosition[];
  soldPositions: AssetPosition[];
  latestValuations: Record<string, CardValuation>;
  sales: CardSale[];
}

export function CollectionView({
  heldLotPositions,
  soldPositions,
  latestValuations,
  sales,
}: CollectionViewProps) {
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [showSold, setShowSold] = useState(false);

  const visibleHeldLots = showSold ? [] : heldLotPositions;
  const visibleSold = showSold ? soldPositions : [];

  const sports = [
    ...new Set(
      (showSold
        ? soldPositions.map((p) => p.asset.sport)
        : heldLotPositions.map((p) => p.asset.sport)
      )
    ),
  ].sort();

  const filteredHeldLots = visibleHeldLots.filter(({ asset, lot }) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      asset.player_name.toLowerCase().includes(q) ||
      asset.card_type.toLowerCase().includes(q) ||
      asset.sport.toLowerCase().includes(q) ||
      (asset.card_number?.toLowerCase().includes(q) ?? false) ||
      (asset.insert_parallel?.toLowerCase().includes(q) ?? false) ||
      gradeLabel(lot).toLowerCase().includes(q) ||
      (lot.cert_number?.toLowerCase().includes(q) ?? false);

    const matchesSport = !sportFilter || asset.sport === sportFilter;
    return matchesSearch && matchesSport;
  });

  const filteredSold = visibleSold.filter(({ asset, lots }) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      asset.player_name.toLowerCase().includes(q) ||
      asset.card_type.toLowerCase().includes(q) ||
      asset.sport.toLowerCase().includes(q) ||
      (asset.card_number?.toLowerCase().includes(q) ?? false) ||
      (asset.insert_parallel?.toLowerCase().includes(q) ?? false) ||
      lots.some(
        (lot) =>
          gradeLabel(lot).toLowerCase().includes(q) ||
          (lot.cert_number?.toLowerCase().includes(q) ?? false)
      );

    const matchesSport = !sportFilter || asset.sport === sportFilter;
    return matchesSearch && matchesSport;
  });

  const salesByAsset = Object.fromEntries(
    [...heldLotPositions, ...soldPositions].reduce((map, item) => {
      const assetId = item.asset.id;
      if (!map.has(assetId)) {
        map.set(assetId, salesForAsset(sales, assetId));
      }
      return map;
    }, new Map<string, CardSale[]>())
  );

  const filteredHeldGroups = groupHeldLotsByIdentity(filteredHeldLots);
  const filteredCount = showSold
    ? filteredSold.length
    : filteredHeldGroups.length;
  const filteredLotCount = showSold
    ? filteredSold.reduce((n, p) => n + p.lots.length, 0)
    : filteredHeldLots.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search players, sets, grades, cert numbers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={sportFilter === null ? "default" : "outline"}
            onClick={() => setSportFilter(null)}
          >
            All
          </Button>
          {sports.map((sport) => (
            <Button
              key={sport}
              variant={sportFilter === sport ? "default" : "outline"}
              onClick={() => setSportFilter(sport)}
            >
              {sport}
            </Button>
          ))}
          {soldPositions.length > 0 && (
            <Button
              variant={showSold ? "secondary" : "outline"}
              onClick={() => setShowSold((v) => !v)}
            >
              {showSold ? "Hide Sold" : `Show Sold (${soldPositions.length})`}
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filteredCount} {showSold ? "asset" : "card"}
        {filteredCount !== 1 ? "s" : ""}
        {!showSold && filteredLotCount !== filteredCount && (
          <> · {filteredLotCount} lots</>
        )}
        {showSold ? " shown" : " in your holdings"}
        {search || sportFilter ? " matching filters" : ""}
        {!showSold && soldPositions.length > 0 && (
          <> · {soldPositions.length} sold hidden</>
        )}
      </p>

      <CardList
        heldLots={filteredHeldLots}
        soldPositions={filteredSold}
        latestValuations={latestValuations}
        salesByAsset={salesByAsset}
        showSold={showSold}
      />
    </div>
  );
}
