"use client";

import { useState } from "react";
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
import { deleteCard } from "@/app/actions/cards";
import type { Card } from "@/types/card";
import { cardTitle } from "@/types/card";
import { cn } from "@/lib/utils";

interface DeleteCardDialogProps {
  card: Card;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function DeleteCardDialog({
  card,
  compact = false,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: DeleteCardDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  async function handleDelete() {
    setDeleting(true);
    await deleteCard(card.id);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger
          render={
            <Button
              variant={compact ? "ghost" : "destructive"}
              size={compact ? "icon-sm" : "default"}
              className={cn(compact && "text-destructive hover:text-destructive")}
              aria-label="Delete asset"
            />
          }
        >
          <Trash2 className="h-4 w-4" />
          {!compact && "Delete"}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete card?</DialogTitle>
          <DialogDescription>
            This will permanently remove {cardTitle(card)} from your collection.
            This action cannot be undone.
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
  );
}
