"use client";

import { useState } from "react";
import { DollarSign, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteLotDialog } from "@/components/delete-lot-dialog";
import { EditLotDialog } from "@/components/edit-lot-dialog";
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

function isLotHeld(lot: Lot): boolean {
  return Number(lot.quantity_remaining) > 0;
}

export function LotRowActions({
  asset,
  lot,
  allLots,
}: {
  asset: Asset;
  lot: Lot;
  allLots: Lot[];
}) {
  const held = isLotHeld(lot);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [soldOpen, setSoldOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          className="outline-none"
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Lot actions"
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
                  setEditOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  setSoldOpen(true);
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
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {held && (
        <>
          <EditLotDialog lot={lot} open={editOpen} onOpenChange={setEditOpen} />
          <MarkCardSoldDialog
            asset={asset}
            lots={allLots}
            lotId={lot.id}
            open={soldOpen}
            onOpenChange={setSoldOpen}
            showTrigger={false}
          />
        </>
      )}
      <DeleteLotDialog
        asset={asset}
        lot={lot}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        showTrigger={false}
      />
    </>
  );
}
