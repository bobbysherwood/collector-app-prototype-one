"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteCardDialog } from "@/components/delete-card-dialog";
import { MarkCardSoldDialog } from "@/components/mark-card-sold-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Asset, Lot } from "@/types/card";

export function CardRowActions({
  asset,
  lots,
  lot,
  held,
}: {
  asset: Asset;
  lots: Lot[];
  lot?: Lot;
  held: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          className="outline-none"
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Asset actions"
            />
          }
        >
          <EllipsisVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {held ? (
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  router.push(`/cards/${asset.id}/edit`);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  setSoldDialogOpen(true);
                }}
              >
                <DollarSign className="h-4 w-4" />
                Mark as Sold
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : null}
          {held ? <DropdownMenuSeparator /> : null}
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                setMenuOpen(false);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {held && (
        <MarkCardSoldDialog
          asset={asset}
          lots={lots}
          lotId={lot?.id}
          open={soldDialogOpen}
          onOpenChange={setSoldDialogOpen}
          showTrigger={false}
        />
      )}
      <DeleteCardDialog
        card={asset}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        showTrigger={false}
      />
    </>
  );
}
