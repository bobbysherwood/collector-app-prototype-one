"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, EllipsisVertical, Trash2 } from "lucide-react";
import {
  deleteCardRepositorySet,
  getCardRepositorySetExportRows,
} from "@/app/actions/card-repository";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCardRepositorySetExcel } from "@/lib/card-repository-export";
import type { CardRepositorySetSummary } from "@/types/card-repository";

export function CardRepositorySetRowActions({
  set,
}: {
  set: CardRepositorySetSummary;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);

    const result = await getCardRepositorySetExportRows(set);
    if (result.error) {
      setError(result.error);
      setExporting(false);
      return;
    }

    if (!result.rows?.length) {
      setError("No cards found to export.");
      setExporting(false);
      return;
    }

    downloadCardRepositorySetExcel(`${set.year} ${set.cardSet}`, result.rows);
    setExporting(false);
    setMenuOpen(false);
  }

  async function handleDelete() {
    setPending(true);
    setError(null);

    const result = await deleteCardRepositorySet(set);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    setPending(false);
    setDeleteOpen(false);
    setMenuOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          className="outline-none"
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Set actions"
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <EllipsisVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={exporting}
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen(false);
                void handleExport();
              }}
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export"}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
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

      <Dialog open={deleteOpen} onOpenChange={(open) => !pending && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete card set?</DialogTitle>
            <DialogDescription>
              Permanently delete all {set.cards} card{set.cards === 1 ? "" : "s"} in{" "}
              {set.year} {set.cardSet}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting..." : "Delete Set"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
