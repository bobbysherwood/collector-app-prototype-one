"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreHorizontal, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import {
  createMarketSentimentSource,
  deleteMarketSentimentSource,
  setMarketSentimentSourceActive,
  updateMarketSentimentSource,
} from "@/app/actions/market-sentiment-sources";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { MarketSentimentSource } from "@/types/market-sentiment";

export function AdminMarketSentimentSourcesPanel({
  sources,
  readOnly = false,
}: {
  sources: MarketSentimentSource[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<MarketSentimentSource | null>(null);
  const [deleteRow, setDeleteRow] = useState<MarketSentimentSource | null>(null);
  const [formSlug, setFormSlug] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formWeight, setFormWeight] = useState("0");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const activeWeightTotal = useMemo(
    () =>
      sources
        .filter((source) => source.active)
        .reduce((sum, source) => sum + source.weightPercent, 0),
    [sources]
  );

  async function runAction(
    action: () => Promise<{ error?: string }>,
    onSuccess?: () => void
  ) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSuccess?.();
    router.refresh();
  }

  function openCreate() {
    setFormSlug("");
    setFormName("");
    setFormDescription("");
    setFormWeight("0");
    setError(null);
    setIsCreateOpen(true);
  }

  function openEdit(row: MarketSentimentSource) {
    setEditRow(row);
    setFormSlug(row.slug);
    setFormName(row.name);
    setFormDescription(row.description);
    setFormWeight(String(row.weightPercent));
    setError(null);
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border/80 bg-background px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 className="text-sm font-medium">Market Sentiment sources</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Public data sources and weightings for the V1 Market Sentiment Model.
                Active weights must total 100%.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="gap-2"
                onClick={(event) => {
                  event.preventDefault();
                  openCreate();
                }}
                disabled={readOnly}
              >
                <Plus className="h-4 w-4" />
                Add source
              </Button>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </div>
          </summary>

          <div className="space-y-3 bg-background px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={activeWeightTotal === 100 ? "secondary" : "destructive"}>
                Active weight total: {activeWeightTotal}%
              </Badge>
              {activeWeightTotal !== 100 ? (
                <span className="text-xs text-destructive">
                  Adjust active source weights so they sum to 100.
                </span>
              ) : null}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((row) => (
                  <TableRow key={row.id} className={cn(!row.active && "opacity-70")}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.slug}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.weightPercent}%
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.active ? "secondary" : "outline"}>
                        {row.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {readOnly ? (
                        <span className="text-xs text-muted-foreground">Read-only</span>
                      ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="outline-none"
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Actions for ${row.name}`}
                            />
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() =>
                                runAction(() =>
                                  setMarketSentimentSourceActive({
                                    id: row.id,
                                    active: !row.active,
                                  })
                                )
                              }
                            >
                              {row.active ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                              {row.active ? "Inactivate" : "Activate"}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive"
                            onClick={() => setDeleteRow(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </details>
      </section>

      <SourceFormDialog
        open={isCreateOpen}
        title="Add sentiment source"
        description="Register a new public data source. Active weights must continue to sum to 100%."
        slug={formSlug}
        name={formName}
        descriptionValue={formDescription}
        weight={formWeight}
        pending={pending}
        onOpenChange={setIsCreateOpen}
        onSlugChange={setFormSlug}
        onNameChange={setFormName}
        onDescriptionChange={setFormDescription}
        onWeightChange={setFormWeight}
        onSubmit={() =>
          runAction(
            () =>
              createMarketSentimentSource({
                slug: formSlug,
                name: formName,
                description: formDescription,
                weightPercent: Number(formWeight),
                active: true,
              }),
            () => setIsCreateOpen(false)
          )
        }
      />

      <SourceFormDialog
        open={editRow != null}
        title="Edit sentiment source"
        description="Update source metadata or weighting."
        slug={formSlug}
        name={formName}
        descriptionValue={formDescription}
        weight={formWeight}
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setEditRow(null);
        }}
        onSlugChange={setFormSlug}
        onNameChange={setFormName}
        onDescriptionChange={setFormDescription}
        onWeightChange={setFormWeight}
        onSubmit={() => {
          if (!editRow) return;
          runAction(
            () =>
              updateMarketSentimentSource({
                id: editRow.id,
                slug: formSlug,
                name: formName,
                description: formDescription,
                weightPercent: Number(formWeight),
              }),
            () => setEditRow(null)
          );
        }}
      />

      <Dialog open={deleteRow != null} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete source</DialogTitle>
            <DialogDescription>
              Delete {deleteRow?.name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !deleteRow}
              onClick={() => {
                if (!deleteRow) return;
                runAction(
                  () => deleteMarketSentimentSource(deleteRow.id),
                  () => setDeleteRow(null)
                );
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SourceFormDialog({
  open,
  title,
  description,
  slug,
  name,
  descriptionValue,
  weight,
  pending,
  onOpenChange,
  onSlugChange,
  onNameChange,
  onDescriptionChange,
  onWeightChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  slug: string;
  name: string;
  descriptionValue: string;
  weight: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSlugChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sentiment-source-slug">Slug</Label>
            <Input
              id="sentiment-source-slug"
              value={slug}
              onChange={(event) => onSlugChange(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sentiment-source-name">Name</Label>
            <Input
              id="sentiment-source-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sentiment-source-description">Description</Label>
            <Input
              id="sentiment-source-description"
              value={descriptionValue}
              onChange={(event) => onDescriptionChange(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sentiment-source-weight">Weight (%)</Label>
            <Input
              id="sentiment-source-weight"
              type="number"
              min={0}
              max={100}
              value={weight}
              onChange={(event) => onWeightChange(event.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || !slug.trim() || !name.trim()}
            onClick={onSubmit}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
