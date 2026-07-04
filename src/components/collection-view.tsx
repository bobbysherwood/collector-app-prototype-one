"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardGrid } from "@/components/card-grid";
import type { Card, CardValuation } from "@/types/card";
import { isCardHeld } from "@/types/card";
import { Search } from "lucide-react";

interface CollectionViewProps {
  cards: Card[];
  latestValuations: Record<string, CardValuation>;
}

export function CollectionView({ cards, latestValuations }: CollectionViewProps) {
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [showSold, setShowSold] = useState(false);

  const heldCards = cards.filter(isCardHeld);
  const soldCards = cards.filter((c) => !isCardHeld(c));
  const visibleCards = showSold ? cards : heldCards;

  const sports = [...new Set(visibleCards.map((c) => c.sport))].sort();

  const filtered = visibleCards.filter((card) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      card.player_name.toLowerCase().includes(q) ||
      card.card_type.toLowerCase().includes(q) ||
      card.sport.toLowerCase().includes(q) ||
      (card.card_number?.toLowerCase().includes(q) ?? false) ||
      (card.insert_parallel?.toLowerCase().includes(q) ?? false);

    const matchesSport = !sportFilter || card.sport === sportFilter;
    return matchesSearch && matchesSport;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search players, sets, parallels..."
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
          {soldCards.length > 0 && (
            <Button
              variant={showSold ? "secondary" : "outline"}
              onClick={() => setShowSold((v) => !v)}
            >
              {showSold ? "Hide Sold" : `Show Sold (${soldCards.length})`}
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} card{filtered.length !== 1 ? "s" : ""}
        {showSold ? " shown" : " in active collection"}
        {search || sportFilter ? " matching filters" : ""}
        {!showSold && soldCards.length > 0 && (
          <> · {soldCards.length} sold hidden</>
        )}
      </p>

      <CardGrid
        cards={filtered}
        latestValuations={latestValuations}
        showSold={showSold}
      />
    </div>
  );
}
