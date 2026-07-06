"use client";

import { useEffect, useState } from "react";
import { listCardRepositoryCardsForSet } from "@/app/actions/card-repository";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CardRepositoryCard,
  CardRepositorySetKey,
} from "@/types/card-repository";

interface CardRepositorySetCardsDialogProps {
  set: CardRepositorySetKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CardRepositorySetCardsDialog({
  set,
  open,
  onOpenChange,
}: CardRepositorySetCardsDialogProps) {
  const [cards, setCards] = useState<CardRepositoryCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !set) {
      return;
    }

    let cancelled = false;

    async function loadCards() {
      setLoading(true);
      setError(null);
      const result = await listCardRepositoryCardsForSet(set!);
      if (cancelled) return;

      if (result.error) {
        setError(result.error);
        setCards([]);
      } else {
        setCards(result.cards ?? []);
      }
      setLoading(false);
    }

    loadCards();
    return () => {
      cancelled = true;
    };
  }, [open, set]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {set ? `${set.year} ${set.cardSet}` : "Card Set"}
          </DialogTitle>
          <DialogDescription>
            {set
              ? `${set.category} · ${set.manufacturer} · ${set.brand}`
              : "Cards in this set"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading cards...</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : cards.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No cards found in this set.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card Number</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Parallel</TableHead>
                <TableHead className="text-right">Serial #</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="tabular-nums">{card.cardNumber}</TableCell>
                  <TableCell className="font-medium">{card.player}</TableCell>
                  <TableCell>{card.parallel ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {card.serialNumber ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
