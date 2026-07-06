"use client";

import { useState } from "react";
import { CardRepositorySetCardsDialog } from "@/components/card-repository-set-cards-dialog";
import { CardRepositorySetRowActions } from "@/components/card-repository-set-row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CardRepositorySetSummary } from "@/types/card-repository";
import { cn } from "@/lib/utils";

export function AdminCardRepositoryTable({
  sets,
}: {
  sets: CardRepositorySetSummary[];
}) {
  const [selectedSet, setSelectedSet] = useState<CardRepositorySetSummary | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  function openSet(set: CardRepositorySetSummary) {
    setSelectedSet(set);
    setDialogOpen(true);
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Manufacturer</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Card Set</TableHead>
            <TableHead className="text-right">Cards</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sets.map((set) => (
            <TableRow
              key={`${set.category}-${set.year}-${set.manufacturer}-${set.brand}-${set.cardSet}`}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => openSet(set)}
            >
              <TableCell className="font-medium">{set.category}</TableCell>
              <TableCell className="tabular-nums">{set.year}</TableCell>
              <TableCell>{set.manufacturer}</TableCell>
              <TableCell>{set.brand}</TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openSet(set);
                  }}
                  className={cn(
                    "text-left font-medium text-primary underline-offset-4",
                    "hover:underline focus-visible:underline focus-visible:outline-none"
                  )}
                >
                  {set.cardSet}
                </button>
              </TableCell>
              <TableCell className="text-right tabular-nums">{set.cards}</TableCell>
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <CardRepositorySetRowActions set={set} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CardRepositorySetCardsDialog
        set={selectedSet}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
