"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteCard } from "@/app/actions/cards";
import { CardValuationSection } from "@/components/card-valuation-section";
import { MarkCardSoldDialog } from "@/components/mark-card-sold-dialog";
import type { Card, CardValuation } from "@/types/card";
import {
  cardTitle,
  formatCurrency,
  cardCostBasis,
  cardSaleProceeds,
  gradeLabel,
  isCardHeld,
  percentChange,
  formatPercent,
} from "@/types/card";
import { getImageUrl } from "@/lib/images";

interface CardDetailProps {
  card: Card;
  valuations: CardValuation[];
}

export function CardDetail({ card, valuations }: CardDetailProps) {
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const imageUrl = getImageUrl(card.image_path);
  const held = isCardHeld(card);
  const saleProceeds = cardSaleProceeds(card);
  const costBasis = cardCostBasis(card);
  const realizedGain =
    saleProceeds != null ? percentChange(costBasis, saleProceeds) : null;

  async function handleDelete() {
    setDeleting(true);
    await deleteCard(card.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/collection">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Collection
          </Button>
        </Link>
        <div className="ml-auto flex gap-2">
          {held && <MarkCardSoldDialog card={card} />}
          {held && (
            <Link href={`/cards/${card.id}/edit`}>
              <Button variant="outline" className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete card?</DialogTitle>
                <DialogDescription>
                  This will permanently remove {cardTitle(card)} from your
                  collection. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!held && (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Sold</Badge>
            <p className="text-sm text-muted-foreground">
              This card is no longer in your active portfolio.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="relative aspect-[2.5/3.5] w-full max-w-[320px] overflow-hidden rounded-xl border border-border bg-muted mx-auto lg:mx-0">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={cardTitle(card)}
              fill
              className={`object-contain p-3 ${held ? "" : "grayscale-[35%]"}`}
              priority
              sizes="320px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-6xl font-bold text-muted-foreground/20">
                {card.player_name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-start gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {cardTitle(card)}
              </h1>
              {card.quantity > 1 && (
                <Badge variant="secondary">Qty: {card.quantity}</Badge>
              )}
              {!held && <Badge variant="secondary">Sold</Badge>}
            </div>
            <p className="text-muted-foreground mt-1">
              {card.sport}
              {card.card_number ? ` · #${card.card_number}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{gradeLabel(card)}</Badge>
            {card.insert_parallel && (
              <Badge variant="outline">{card.insert_parallel}</Badge>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Cost Basis" value={formatCurrency(costBasis)} />
            <DetailField
              label="Purchase Price"
              value={`${formatCurrency(card.purchase_price)}${card.quantity > 1 ? " each" : ""}`}
            />
            <DetailField label="Purchase Date" value={card.purchase_date} />
            <DetailField label="Card Type" value={card.card_type} />
            <DetailField label="Year" value={card.year.toString()} />
            <DetailField label="Sport" value={card.sport} />
            {card.card_number && (
              <DetailField label="Card Number" value={card.card_number} />
            )}
            {card.cert_number && (
              <DetailField label="Cert Number" value={card.cert_number} />
            )}
            {!held && card.sold_at && (
              <DetailField label="Sale Date" value={card.sold_at} />
            )}
            {!held && card.sold_price != null && (
              <DetailField
                label="Sale Value"
                value={`${formatCurrency(card.sold_price)}${card.quantity > 1 ? " each" : ""}`}
              />
            )}
            {!held && saleProceeds != null && (
              <DetailField
                label="Sale Proceeds"
                value={formatCurrency(saleProceeds)}
              />
            )}
            {!held && realizedGain != null && saleProceeds != null && (
              <DetailField
                label="Realized Gain / Loss"
                value={`${formatCurrency(saleProceeds - costBasis)} (${formatPercent(realizedGain)})`}
              />
            )}
          </div>

          {card.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{card.notes}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <CardValuationSection card={card} valuations={valuations} />
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm font-medium mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
