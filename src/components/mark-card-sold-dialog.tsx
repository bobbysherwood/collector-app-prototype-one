"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Asset, Lot } from "@/types/card";
import { cardTitle, gradeLabel } from "@/types/card";

interface MarkCardSoldDialogProps {
  asset: Asset;
  lots: Lot[];
  lotId?: string;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function MarkCardSoldDialog({
  asset,
  lots,
  lotId: defaultLotId,
  compact = false,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: MarkCardSoldDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [salePrice, setSalePrice] = useState("");
  const [selectedLotId, setSelectedLotId] = useState<string>(
    defaultLotId ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const openLots = lots.filter((l) => l.quantity_remaining > 0);
  const activeLotId =
    defaultLotId ??
    (selectedLotId || (openLots.length === 1 ? openLots[0].id : ""));
  const activeLot = openLots.find((l) => l.id === activeLotId);
  const minPurchaseDate = activeLot?.purchase_date ?? saleDate;
  const showLotPicker = !defaultLotId && openLots.length > 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(salePrice);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a valid sale value.");
      return;
    }

    if (showLotPicker && !activeLotId) {
      setError("Select which lot to sell.");
      return;
    }

    setLoading(true);
    const result = await markCardSold(
      asset.id,
      saleDate,
      parsed,
      activeLotId || undefined
    );
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
      {showTrigger && (
        <DialogTrigger
          render={
            <Button
              variant={compact ? "ghost" : "outline"}
              size={compact ? "icon-sm" : "default"}
              className={compact ? undefined : "gap-2"}
              aria-label="Mark as sold"
            />
          }
        >
          <DollarSign className="h-4 w-4" />
          {!compact && "Mark as Sold"}
        </DialogTrigger>
      )}
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record sale</DialogTitle>
            <DialogDescription>
              Record a sale of {cardTitle(asset)}
              {activeLot ? ` (${gradeLabel(activeLot)})` : ""}. Each lot
              represents one physical card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            {showLotPicker && (
              <div className="space-y-2">
                <Label>Sell lot *</Label>
                <Select
                  value={selectedLotId}
                  onValueChange={(v) => setSelectedLotId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a lot" />
                  </SelectTrigger>
                  <SelectContent>
                    {openLots.map((lot) => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {lot.purchase_date} · {gradeLabel(lot)}
                        {lot.cert_number ? ` · #${lot.cert_number}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`sale_date_${asset.id}`}>Sale Date *</Label>
              <Input
                id={`sale_date_${asset.id}`}
                type="date"
                required
                min={minPurchaseDate}
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`sale_price_${asset.id}`}>Sale Value *</Label>
              <Input
                id={`sale_price_${asset.id}`}
                type="number"
                required
                min={0}
                step="0.01"
                placeholder="0.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
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
