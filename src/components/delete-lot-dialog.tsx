"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteLot } from "@/app/actions/cards";
import type { Asset, Lot } from "@/types/card";
import { cardTitle, gradeLabel } from "@/types/card";
import { cn } from "@/lib/utils";

interface DeleteLotDialogProps {
  asset: Asset;
  lot: Lot;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function DeleteLotDialog({
  asset,
  lot,
  compact = false,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: DeleteLotDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const result = await deleteLot(lot.id);
    if (result.error) {
      setError(result.error);
      setDeleting(false);
      return;
    }

    setOpen(false);
    setDeleting(false);

    if (result.assetDeleted) {
      router.push("/holdings");
    } else {
      router.refresh();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!deleting) {
          setOpen(nextOpen);
          if (!nextOpen) setError(null);
        }
      }}
    >
      {showTrigger && (
        <DialogTrigger
          render={
            <Button
              variant={compact ? "ghost" : "destructive"}
              size={compact ? "icon-sm" : "default"}
              className={cn(compact && "text-destructive hover:text-destructive")}
              aria-label="Delete lot"
            />
          }
        >
          <Trash2 className="h-4 w-4" />
          {!compact && "Delete"}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete acquisition?</DialogTitle>
          <DialogDescription>
            This will permanently remove this {gradeLabel(lot)} copy of{" "}
            {cardTitle(asset)} (purchased {lot.purchase_date}). Other copies of
            this card will not be affected. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
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
  );
}
