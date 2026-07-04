import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { Card, CardValuation } from "@/types/card";
import {
  cardTitle,
  formatCurrency,
  cardCostBasis,
  cardMarketValue,
  cardSaleProceeds,
  gradeLabel,
  formatPercent,
  percentChange,
  isCardHeld,
} from "@/types/card";
import { getImageUrl } from "@/lib/images";

interface CardGridProps {
  cards: Card[];
  latestValuations?: Record<string, CardValuation>;
  showSold?: boolean;
}

export function CardGrid({
  cards,
  latestValuations = {},
  showSold = false,
}: CardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card py-20 text-center shadow-sm">
        <p className="text-lg font-medium mb-1">
          {showSold ? "No sold cards match your filters" : "Your collection is empty"}
        </p>
        <p className="text-sm text-muted-foreground">
          {showSold
            ? "Try adjusting your search or filters."
            : "Use Add Card in the top bar to start tracking your portfolio."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <CardTile
          key={card.id}
          card={card}
          latestValuation={latestValuations[card.id]}
        />
      ))}
    </div>
  );
}

function CardTile({
  card,
  latestValuation,
}: {
  card: Card;
  latestValuation?: CardValuation;
}) {
  const imageUrl = getImageUrl(card.image_path);
  const costBasis = cardCostBasis(card);
  const sold = !isCardHeld(card);
  const saleProceeds = sold ? cardSaleProceeds(card) : null;
  const marketValue = !sold && latestValuation
    ? cardMarketValue(latestValuation.value, card.quantity)
    : null;
  const gainPercent =
    marketValue != null ? percentChange(costBasis, marketValue) : null;
  const saleGainPercent =
    saleProceeds != null ? percentChange(costBasis, saleProceeds) : null;

  return (
    <Link
      href={`/cards/${card.id}`}
      className={`group overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all hover:border-primary/30 hover:shadow-lg ${
        sold ? "opacity-80" : ""
      }`}
    >
      <div className="relative aspect-[2.5/3.5] bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={cardTitle(card)}
            fill
            className={`object-contain p-2 transition-transform group-hover:scale-[1.02] ${
              sold ? "grayscale-[35%]" : ""
            }`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="text-4xl font-bold opacity-20">
              {card.player_name.charAt(0)}
            </span>
          </div>
        )}
        {sold && (
          <Badge className="absolute top-2 left-2" variant="secondary">
            Sold
          </Badge>
        )}
        {card.quantity > 1 && (
          <Badge className="absolute top-2 right-2" variant="secondary">
            ×{card.quantity}
          </Badge>
        )}
      </div>
      <div className="p-4 space-y-1">
        <p className="font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {cardTitle(card)}
        </p>
        <p className="text-xs text-muted-foreground">
          {card.sport}
          {card.card_number ? ` · #${card.card_number}` : ""}
          {card.insert_parallel ? ` · ${card.insert_parallel}` : ""}
        </p>
        <div className="flex items-center justify-between pt-1">
          <Badge variant="outline" className="text-xs font-normal">
            {gradeLabel(card)}
          </Badge>
          <div className="text-right">
            {sold && saleProceeds != null ? (
              <>
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(saleProceeds)}
                </span>
                {saleGainPercent != null && (
                  <p
                    className={`text-xs tabular-nums ${
                      saleGainPercent >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {formatPercent(saleGainPercent)}
                  </p>
                )}
              </>
            ) : marketValue != null ? (
              <>
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(marketValue)}
                </span>
                {gainPercent != null && (
                  <p
                    className={`text-xs tabular-nums ${
                      gainPercent >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {formatPercent(gainPercent)}
                  </p>
                )}
              </>
            ) : (
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {formatCurrency(costBasis)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
