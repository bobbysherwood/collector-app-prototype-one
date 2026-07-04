"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { markCardSold } from "@/app/actions/sales";
import type { Card } from "@/types/card";
import { cardTitle } from "@/types/card";

interface MarkCardSoldDialogProps {
  card: Card;
}

export function MarkCardSoldDialog({ card }: MarkCardSoldDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [salePrice, setSalePrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(salePrice);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a valid sale value.");
      return;
    }

    setLoading(true);
    const result = await markCardSold(card.id, saleDate, parsed);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" className="gap-2">
          <DollarSign className="h-4 w-4" />
          Mark as Sold
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Mark card as sold</DialogTitle>
            <DialogDescription>
              Record the sale of {cardTitle(card)}. It will be removed from your
              active portfolio and hidden from the collection by default.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="sale_date">Sale Date *</Label>
              <Input
                id="sale_date"
                type="date"
                required
                min={card.purchase_date}
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale_price">Sale Value (per card) *</Label>
              <Input
                id="sale_price"
                type="number"
                required
                min={0}
                step="0.01"
                placeholder="0.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
              {card.quantity > 1 && (
                <p className="text-xs text-muted-foreground">
                  Total proceeds:{" "}
                  {salePrice
                    ? `$${(parseFloat(salePrice) * card.quantity).toFixed(2)}`
                    : "—"}{" "}
                  ({card.quantity} cards)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !salePrice}>
              {loading ? "Saving..." : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
