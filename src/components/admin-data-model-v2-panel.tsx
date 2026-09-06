"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ImageIcon,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import {
  createPickListOption,
  deletePickListOption,
  setPickListOptionActive,
  updatePickListOption,
} from "@/app/actions/pick-lists";
import {
  createDm2Attribute,
  createDm2Brand,
  createDm2CardSet,
  createDm2CardSetCategory,
  createDm2CardSetName,
  createDm2Manufacturer,
  createDm2Parallel,
  deleteDm2Attribute,
  deleteDm2Brand,
  deleteDm2CardSet,
  deleteDm2CardSetCategory,
  deleteDm2CardSetName,
  deleteDm2Manufacturer,
  deleteDm2Parallel,
  deleteDm2CardImage,
  assignDm2CardAttribute,
  removeDm2CardAttribute,
  setDm2AttributeActive,
  setDm2CardActive,
  setDm2CardSetActive,
  setDm2CardSetCategoryActive,
  setDm2CardSetNameActive,
  setDm2ManufacturerActive,
  setDm2ParallelActive,
  setDm2BrandActive,
  updateDm2Attribute,
  updateDm2Brand,
  updateDm2Card,
  updateDm2CardAttribute,
  updateDm2CardSet,
  updateDm2CardSetCategory,
  updateDm2CardSetName,
  updateDm2Manufacturer,
  updateDm2Parallel,
  fetchDm2CardsForCardSet,
  fetchDm2CardCountsBySetId,
  uploadDm2CardImage,
} from "@/app/actions/data-model-v2";
import { ImageUpload } from "@/components/image-upload";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDm2CardImageUrl } from "@/lib/images";
import { sortPickListOptions } from "@/lib/pick-list-utils";
import { cn } from "@/lib/utils";
import type {
  Dm2Attribute,
  Dm2Brand,
  Dm2Card,
  Dm2CardAttributeAssignment,
  Dm2CardSet,
  Dm2CardSetCategory,
  Dm2CardSetName,
  Dm2Manufacturer,
  Dm2Parallel,
  Dm2Player,
} from "@/types/data-model-v2";
import type { PickListOption } from "@/types/pick-list";
import { AdminDm2CardPopulationSection } from "@/components/admin-dm2-card-population-section";
import { AdminDm2PlayersSection } from "@/components/admin-dm2-players-section";
import { Dm2AiLoaderDialog } from "@/components/dm2-ai-loader-dialog";

function IdCell({ id }: { id: string }) {
  return (
    <span className="font-mono text-xs text-muted-foreground">{id}</span>
  );
}

export function AdminDataModelV2Panel({
  sports,
  cardSetCategories,
  cardSetNames,
  manufacturers,
  brands,
  parallels,
  players,
  attributes,
  cardSets,
}: {
  sports: PickListOption[];
  cardSetCategories: Dm2CardSetCategory[];
  cardSetNames: Dm2CardSetName[];
  manufacturers: Dm2Manufacturer[];
  brands: Dm2Brand[];
  parallels: Dm2Parallel[];
  players: Dm2Player[];
  attributes: Dm2Attribute[];
  cardSets: Dm2CardSet[];
}) {
  const router = useRouter();
  const [cardCountsBySetId, setCardCountsBySetId] = useState<
    Record<string, number>
  >({});
  const [cardCountsLoading, setCardCountsLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOption, setEditOption] = useState<PickListOption | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deleteOption, setDeleteOption] = useState<PickListOption | null>(null);

  const sortedSports = useMemo(() => sortPickListOptions(sports), [sports]);
  const activeCount = sortedSports.filter((row) => row.active).length;

  useEffect(() => {
    let cancelled = false;
    setCardCountsLoading(true);

    void fetchDm2CardCountsBySetId().then((result) => {
      if (cancelled) return;
      if (result.counts) {
        setCardCountsBySetId(result.counts);
      }
      setCardCountsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Data Model v2</h2>
          <p className="text-sm text-muted-foreground">
            View and manage catalog tables for the data model hierarchy
          </p>
        </div>
        <Dm2AiLoaderDialog />
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 className="text-sm font-medium">Sport Table</h3>
              <p className="text-xs text-muted-foreground">
                {activeCount} active · {sortedSports.length} total
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="border-t border-border/80 bg-background px-4 py-3">
            {sortedSports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sports yet. Add one below.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sport</TableHead>
                    <TableHead>Sport ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSports.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(!row.active && "opacity-70")}
                    >
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell>
                        <IdCell id={row.id} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.active ? "secondary" : "outline"}>
                          {row.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="outline-none"
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Actions for ${row.label}`}
                              />
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  setEditOption(row);
                                  setEditLabel(row.label);
                                  setError(null);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                  runAction(() =>
                                    setPickListOptionActive({
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
                              onClick={() => {
                                setDeleteOption(row);
                                setError(null);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                runAction(
                  () =>
                    createPickListOption({
                      category: "sport",
                      label: newLabel,
                    }),
                  () => setNewLabel("")
                );
              }}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="add-sport">Add sport</Label>
                <Input
                  id="add-sport"
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  placeholder="New sport"
                  disabled={pending}
                />
              </div>
              <Button
                type="submit"
                className="gap-2"
                disabled={pending || !newLabel.trim()}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>

            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}
          </div>
        </details>
      </section>

      <Dialog
        open={editOption != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditOption(null);
            setEditLabel("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit sport</DialogTitle>
            <DialogDescription>
              Update the sport label shown in Add/Edit Asset dropdowns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-sport-label">Sport</Label>
            <Input
              id="edit-sport-label"
              value={editLabel}
              onChange={(event) => setEditLabel(event.target.value)}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOption(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              disabled={pending || !editLabel.trim() || !editOption}
              onClick={() => {
                if (!editOption) return;
                runAction(
                  () =>
                    updatePickListOption({
                      id: editOption.id,
                      label: editLabel,
                    }),
                  () => setEditOption(null)
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOption != null}
        onOpenChange={(open) => {
          if (!open) setDeleteOption(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete sport</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteOption?.label}&quot; from the sport table?
              Existing assets that already use this value will keep it, but it
              will no longer appear in dropdowns.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOption(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !deleteOption}
              onClick={() => {
                if (!deleteOption) return;
                runAction(
                  () => deletePickListOption(deleteOption.id),
                  () => setDeleteOption(null)
                );
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardSetCategorySection rows={cardSetCategories} />
      <CardSetNameSection rows={cardSetNames} />
      <ManufacturerSection rows={manufacturers} />
      <BrandSection rows={brands} manufacturers={manufacturers} />
      <ParallelSection rows={parallels} />
      <AdminDm2PlayersSection players={players} sports={sports} />
      <AttributeSection rows={attributes} />
      <CardSetSection
        rows={cardSets}
        cardCountsBySetId={cardCountsBySetId}
        cardCountsLoading={cardCountsLoading}
        sports={sports}
        brands={brands}
        cardSetCategories={cardSetCategories}
        cardSetNames={cardSetNames}
        parallels={parallels}
        players={players}
        attributes={attributes}
      />
      <AdminDm2CardPopulationSection cardSets={cardSets} />
    </div>
  );
}

type Dm2NameRow = {
  id: string;
  name: string;
  active: boolean;
};

type Dm2NameLookupActions = {
  create: (name: string) => Promise<{ error?: string }>;
  update: (input: { id: string; name: string }) => Promise<{ error?: string }>;
  setActive: (input: { id: string; active: boolean }) => Promise<{ error?: string }>;
  remove: (id: string) => Promise<{ error?: string }>;
};

function Dm2NameLookupSection({
  title,
  rows,
  emptyMessage,
  addFieldLabel,
  addPlaceholder,
  editDialogTitle,
  editDialogDescription,
  deleteDialogTitle,
  fieldIdPrefix,
  actions,
}: {
  title: string;
  rows: Dm2NameRow[];
  emptyMessage: string;
  addFieldLabel: string;
  addPlaceholder: string;
  editDialogTitle: string;
  editDialogDescription: string;
  deleteDialogTitle: string;
  fieldIdPrefix: string;
  actions: Dm2NameLookupActions;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Dm2NameRow | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteRow, setDeleteRow] = useState<Dm2NameRow | null>(null);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );
  const activeCount = sortedRows.filter((row) => row.active).length;

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

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {activeCount} active · {sortedRows.length} total
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="border-t border-border/80 bg-background px-4 py-3">
            {sortedRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(!row.active && "opacity-70")}
                    >
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <IdCell id={row.id} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.active ? "secondary" : "outline"}>
                          {row.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
                                onClick={() => {
                                  setEditRow(row);
                                  setEditName(row.name);
                                  setError(null);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                  runAction(() =>
                                    actions.setActive({
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
                              onClick={() => {
                                setDeleteRow(row);
                                setError(null);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                runAction(
                  () => actions.create(newName),
                  () => setNewName("")
                );
              }}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={`add-${fieldIdPrefix}`}>{addFieldLabel}</Label>
                <Input
                  id={`add-${fieldIdPrefix}`}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder={addPlaceholder}
                  maxLength={100}
                  disabled={pending}
                />
              </div>
              <Button
                type="submit"
                className="gap-2"
                disabled={pending || !newName.trim()}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>

            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}
          </div>
        </details>
      </section>

      <Dialog
        open={editRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditRow(null);
            setEditName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editDialogTitle}</DialogTitle>
            <DialogDescription>{editDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`edit-${fieldIdPrefix}-name`}>Name</Label>
            <Input
              id={`edit-${fieldIdPrefix}-name`}
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              maxLength={100}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRow(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              disabled={pending || !editName.trim() || !editRow}
              onClick={() => {
                if (!editRow) return;
                runAction(
                  () =>
                    actions.update({
                      id: editRow.id,
                      name: editName,
                    }),
                  () => setEditRow(null)
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteRow != null}
        onOpenChange={(open) => {
          if (!open) setDeleteRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteDialogTitle}</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteRow?.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRow(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !deleteRow}
              onClick={() => {
                if (!deleteRow) return;
                runAction(
                  () => actions.remove(deleteRow.id),
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

function CardSetCategorySection({ rows }: { rows: Dm2CardSetCategory[] }) {
  return (
    <Dm2NameLookupSection
      title="Card Set Category"
      rows={rows}
      emptyMessage="No card set categories yet. Add one below."
      addFieldLabel="Add category"
      addPlaceholder="New card set category"
      editDialogTitle="Edit card set category"
      editDialogDescription="Update the card set category name."
      deleteDialogTitle="Delete card set category"
      fieldIdPrefix="card-set-category"
      actions={{
        create: (name) => createDm2CardSetCategory({ name }),
        update: updateDm2CardSetCategory,
        setActive: setDm2CardSetCategoryActive,
        remove: deleteDm2CardSetCategory,
      }}
    />
  );
}

function CardSetNameSection({ rows }: { rows: Dm2CardSetName[] }) {
  return (
    <Dm2NameLookupSection
      title="Card Set Name"
      rows={rows}
      emptyMessage="No card set names yet. Add one below."
      addFieldLabel="Add name"
      addPlaceholder="New card set name"
      editDialogTitle="Edit card set name"
      editDialogDescription="Update the card set name."
      deleteDialogTitle="Delete card set name"
      fieldIdPrefix="card-set-name"
      actions={{
        create: (name) => createDm2CardSetName({ name }),
        update: updateDm2CardSetName,
        setActive: setDm2CardSetNameActive,
        remove: deleteDm2CardSetName,
      }}
    />
  );
}

function ManufacturerSection({ rows }: { rows: Dm2Manufacturer[] }) {
  return (
    <Dm2NameLookupSection
      title="Manufacturer"
      rows={rows}
      emptyMessage="No manufacturers yet. Add one below."
      addFieldLabel="Add manufacturer"
      addPlaceholder="New manufacturer"
      editDialogTitle="Edit manufacturer"
      editDialogDescription="Update the manufacturer name."
      deleteDialogTitle="Delete manufacturer"
      fieldIdPrefix="manufacturer"
      actions={{
        create: (name) => createDm2Manufacturer({ name }),
        update: updateDm2Manufacturer,
        setActive: setDm2ManufacturerActive,
        remove: deleteDm2Manufacturer,
      }}
    />
  );
}

function BrandSection({
  rows,
  manufacturers,
}: {
  rows: Dm2Brand[];
  manufacturers: Dm2Manufacturer[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newManufacturerId, setNewManufacturerId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Dm2Brand | null>(null);
  const [editName, setEditName] = useState("");
  const [editManufacturerId, setEditManufacturerId] = useState("");
  const [deleteRow, setDeleteRow] = useState<Dm2Brand | null>(null);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );
  const sortedManufacturers = useMemo(
    () => [...manufacturers].sort((a, b) => a.name.localeCompare(b.name)),
    [manufacturers]
  );
  const activeCount = sortedRows.filter((row) => row.active).length;

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

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 className="text-sm font-medium">Brand</h3>
              <p className="text-xs text-muted-foreground">
                {activeCount} active · {sortedRows.length} total
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="border-t border-border/80 bg-background px-4 py-3">
            {sortedRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No brands yet. Add one below.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Brand ID</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(!row.active && "opacity-70")}
                    >
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <IdCell id={row.id} />
                      </TableCell>
                      <TableCell>{row.manufacturerName}</TableCell>
                      <TableCell>
                        <Badge variant={row.active ? "secondary" : "outline"}>
                          {row.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
                                onClick={() => {
                                  setEditRow(row);
                                  setEditName(row.name);
                                  setEditManufacturerId(row.manufacturerId);
                                  setError(null);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                  runAction(() =>
                                    setDm2BrandActive({
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
                              onClick={() => {
                                setDeleteRow(row);
                                setError(null);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              className="mt-4 grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                runAction(
                  () =>
                    createDm2Brand({
                      name: newName,
                      manufacturerId: newManufacturerId,
                    }),
                  () => {
                    setNewName("");
                    setNewManufacturerId("");
                  }
                );
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="add-brand-name">Brand name</Label>
                <Input
                  id="add-brand-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="New brand"
                  maxLength={100}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label>Manufacturer</Label>
                <Select
                  value={newManufacturerId}
                  onValueChange={(value) => value && setNewManufacturerId(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select manufacturer" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedManufacturers.map((manufacturer) => (
                      <SelectItem key={manufacturer.id} value={manufacturer.id}>
                        {manufacturer.name}
                        {!manufacturer.active ? " (Inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="gap-2"
                disabled={pending || !newName.trim() || !newManufacturerId}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>

            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}
          </div>
        </details>
      </section>

      <Dialog
        open={editRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditRow(null);
            setEditName("");
            setEditManufacturerId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit brand</DialogTitle>
            <DialogDescription>
              Update the brand name and linked manufacturer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-brand-name">Brand name</Label>
              <Input
                id="edit-brand-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                maxLength={100}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Select
                value={editManufacturerId}
                onValueChange={(value) => value && setEditManufacturerId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {sortedManufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer.id} value={manufacturer.id}>
                      {manufacturer.name}
                      {!manufacturer.active ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRow(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                pending ||
                !editName.trim() ||
                !editManufacturerId ||
                !editRow
              }
              onClick={() => {
                if (!editRow) return;
                runAction(
                  () =>
                    updateDm2Brand({
                      id: editRow.id,
                      name: editName,
                      manufacturerId: editManufacturerId,
                    }),
                  () => setEditRow(null)
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteRow != null}
        onOpenChange={(open) => {
          if (!open) setDeleteRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete brand</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteRow?.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRow(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !deleteRow}
              onClick={() => {
                if (!deleteRow) return;
                runAction(
                  () => deleteDm2Brand(deleteRow.id),
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

function ParallelSection({ rows }: { rows: Dm2Parallel[] }) {
  return (
    <Dm2NameLookupSection
      title="Parallel"
      rows={rows}
      emptyMessage="No parallels yet. Add one below."
      addFieldLabel="Add parallel"
      addPlaceholder="New parallel"
      editDialogTitle="Edit parallel"
      editDialogDescription="Update the parallel name."
      deleteDialogTitle="Delete parallel"
      fieldIdPrefix="parallel"
      actions={{
        create: (name) => createDm2Parallel({ name }),
        update: updateDm2Parallel,
        setActive: setDm2ParallelActive,
        remove: deleteDm2Parallel,
      }}
    />
  );
}

function AttributeSection({ rows }: { rows: Dm2Attribute[] }) {
  return (
    <Dm2NameLookupSection
      title="Attributes"
      rows={rows}
      emptyMessage="No attributes yet. Add one below."
      addFieldLabel="Add attribute"
      addPlaceholder="New attribute"
      editDialogTitle="Edit attribute"
      editDialogDescription="Update the attribute name."
      deleteDialogTitle="Delete attribute"
      fieldIdPrefix="attribute"
      actions={{
        create: (name) => createDm2Attribute({ name }),
        update: updateDm2Attribute,
        setActive: setDm2AttributeActive,
        remove: deleteDm2Attribute,
      }}
    />
  );
}

function formatCardSetOptionLabel(cardSet: Dm2CardSet): string {
  return `${cardSet.year} ${cardSet.sportName} · ${cardSet.manufacturerName} | ${cardSet.brandName} · ${cardSet.cardSetName}`;
}

const CARD_SET_CARDS_PAGE_SIZE = 500;
const NONE_PARALLEL_VALUE = "__none__";

function parallelSelectValue(parallelId: string | null): string {
  return parallelId ?? NONE_PARALLEL_VALUE;
}

function parallelIdFromSelect(value: string): string | null {
  return value === NONE_PARALLEL_VALUE ? null : value;
}

function sortDm2CardsByParallelThenNumber(cards: Dm2Card[]): Dm2Card[] {
  return [...cards].sort((left, right) => {
    const leftIsBase = !left.parallelName;
    const rightIsBase = !right.parallelName;
    if (leftIsBase !== rightIsBase) return leftIsBase ? -1 : 1;

    const byParallel = (left.parallelName ?? "").localeCompare(
      right.parallelName ?? "",
      undefined,
      { sensitivity: "base" }
    );
    if (byParallel !== 0) return byParallel;

    const byNumber = left.cardNumber.localeCompare(right.cardNumber, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (byNumber !== 0) return byNumber;

    return left.player.localeCompare(right.player, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

type CardSetGroup = {
  key: string;
  sportName: string;
  year: number;
  manufacturerName: string;
  brandName: string;
  sets: Dm2CardSet[];
  cardSetNameCount: number;
  totalCards: number;
};

function CardSetGroupRows({
  group,
  expanded,
  onToggle,
  cardCountsBySetId,
  cardCountsLoading,
  pending,
  onViewCards,
  onEdit,
  onDelete,
  runAction,
}: {
  group: CardSetGroup;
  expanded: boolean;
  onToggle: () => void;
  cardCountsBySetId: Record<string, number>;
  cardCountsLoading: boolean;
  pending: boolean;
  onViewCards: (row: Dm2CardSet) => void;
  onEdit: (row: Dm2CardSet) => void;
  onDelete: (row: Dm2CardSet) => void;
  runAction: (
    action: () => Promise<{ error?: string }>,
    onSuccess?: () => void
  ) => Promise<void>;
}) {
  return (
    <>
      <TableRow className="bg-muted/20">
        <TableCell>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Collapse ${group.year} ${group.sportName} ${group.manufacturerName} ${group.brandName}`
                : `Expand ${group.year} ${group.sportName} ${group.manufacturerName} ${group.brandName}`
            }
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell>{group.sportName}</TableCell>
        <TableCell className="tabular-nums">{group.year}</TableCell>
        <TableCell>
          {group.manufacturerName} | {group.brandName}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {group.cardSetNameCount}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {cardCountsLoading ? "…" : group.totalCards}
        </TableCell>
        <TableCell />
      </TableRow>
      {expanded &&
        group.sets.map((row) => (
          <CardSetDetailRow
            key={row.id}
            row={row}
            cardCount={
              cardCountsLoading ? null : (cardCountsBySetId[row.id] ?? 0)
            }
            pending={pending}
            onViewCards={onViewCards}
            onEdit={onEdit}
            onDelete={onDelete}
            runAction={runAction}
          />
        ))}
    </>
  );
}

function CardSetDetailRow({
  row,
  cardCount,
  pending,
  onViewCards,
  onEdit,
  onDelete,
  runAction,
}: {
  row: Dm2CardSet;
  cardCount: number | null;
  pending: boolean;
  onViewCards: (row: Dm2CardSet) => void;
  onEdit: (row: Dm2CardSet) => void;
  onDelete: (row: Dm2CardSet) => void;
  runAction: (
    action: () => Promise<{ error?: string }>,
    onSuccess?: () => void
  ) => Promise<void>;
}) {
  return (
    <TableRow className={cn("bg-muted/5", !row.active && "opacity-70")}>
      <TableCell />
      <TableCell colSpan={3} className="pl-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span className="text-muted-foreground">{row.cardSetCategoryName}</span>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="text-left text-primary underline-offset-4 hover:underline"
            onClick={() => onViewCards(row)}
          >
            {row.cardSetName}
          </button>
        </div>
      </TableCell>
      <TableCell />
      <TableCell className="text-right tabular-nums">
        {cardCount == null ? "…" : cardCount}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Badge variant={row.active ? "secondary" : "outline"}>
            {row.active ? "Active" : "Inactive"}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="outline-none"
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Actions for ${row.year} ${row.sportName} ${row.cardSetName}`}
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => onEdit(row)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={pending}
                  onClick={() =>
                    runAction(() =>
                      setDm2CardSetActive({
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
                onClick={() => onDelete(row)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CardSetSection({
  rows,
  cardCountsBySetId,
  cardCountsLoading = false,
  sports,
  brands,
  cardSetCategories,
  cardSetNames,
  parallels,
  players,
  attributes,
}: {
  rows: Dm2CardSet[];
  cardCountsBySetId: Record<string, number>;
  cardCountsLoading?: boolean;
  sports: PickListOption[];
  brands: Dm2Brand[];
  cardSetCategories: Dm2CardSetCategory[];
  cardSetNames: Dm2CardSetName[];
  parallels: Dm2Parallel[];
  players: Dm2Player[];
  attributes: Dm2Attribute[];
}) {
  const router = useRouter();
  const [newSportId, setNewSportId] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newBrandId, setNewBrandId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newCardSetNameId, setNewCardSetNameId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Dm2CardSet | null>(null);
  const [editSportId, setEditSportId] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editBrandId, setEditBrandId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCardSetNameId, setEditCardSetNameId] = useState("");
  const [deleteRow, setDeleteRow] = useState<Dm2CardSet | null>(null);
  const [viewCardsRow, setViewCardsRow] = useState<Dm2CardSet | null>(null);
  const [viewCardsPage, setViewCardsPage] = useState(0);
  const [viewCards, setViewCards] = useState<Dm2Card[]>([]);
  const [viewCardsLoading, setViewCardsLoading] = useState(false);
  const [viewCardsError, setViewCardsError] = useState<string | null>(null);
  const [cardsPending, setCardsPending] = useState(false);
  const [editCardRow, setEditCardRow] = useState<Dm2Card | null>(null);
  const [editCardNumber, setEditCardNumber] = useState("");
  const [editPlayerIds, setEditPlayerIds] = useState<string[]>([]);
  const [editPlayerQuery, setEditPlayerQuery] = useState("");
  const [editParallelId, setEditParallelId] = useState(NONE_PARALLEL_VALUE);
  const [imageCardRow, setImageCardRow] = useState<Dm2Card | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [deleteImageCardRow, setDeleteImageCardRow] = useState<Dm2Card | null>(null);
  const [addAttributeCardRow, setAddAttributeCardRow] = useState<Dm2Card | null>(null);
  const [addAttributeId, setAddAttributeId] = useState("");
  const [editAttributeCardRow, setEditAttributeCardRow] = useState<Dm2Card | null>(null);
  const [editAttributeAssignment, setEditAttributeAssignment] =
    useState<Dm2CardAttributeAssignment | null>(null);
  const [editAttributeId, setEditAttributeId] = useState("");
  const [deleteAttributeCardRow, setDeleteAttributeCardRow] = useState<Dm2Card | null>(null);
  const [deleteAttributeAssignmentId, setDeleteAttributeAssignmentId] = useState("");

  function openAddAttributeDialog(card: Dm2Card) {
    setAddAttributeCardRow(card);
    setAddAttributeId("");
    setViewCardsError(null);
  }

  function openEditAttributeDialog(
    card: Dm2Card,
    assignment: Dm2CardAttributeAssignment
  ) {
    setEditAttributeCardRow(card);
    setEditAttributeAssignment(assignment);
    setEditAttributeId(assignment.attributeId);
    setViewCardsError(null);
  }

  function openDeleteAttributeDialog(card: Dm2Card) {
    setDeleteAttributeCardRow(card);
    setDeleteAttributeAssignmentId(card.attributes[0]?.id ?? "");
    setViewCardsError(null);
  }

  function openImageDialog(card: Dm2Card) {
    setImageCardRow(card);
    setImageFile(null);
    setViewCardsError(null);
  }

  async function reloadViewCards() {
    if (!viewCardsRow) return;

    setViewCardsLoading(true);
    setViewCardsError(null);

    const result = await fetchDm2CardsForCardSet(viewCardsRow.id);
    if (result.error) {
      setViewCardsError(result.error);
      setViewCards([]);
    } else {
      setViewCards(sortDm2CardsByParallelThenNumber(result.cards ?? []));
    }

    setViewCardsLoading(false);
  }

  async function runCardsAction(
    action: () => Promise<{ error?: string }>,
    onSuccess?: () => void
  ) {
    setCardsPending(true);
    setViewCardsError(null);
    const result = await action();
    setCardsPending(false);

    if (result.error) {
      setViewCardsError(result.error);
      return;
    }

    onSuccess?.();
    await reloadViewCards();
    router.refresh();
  }

  useEffect(() => {
    if (!viewCardsRow) {
      setViewCards([]);
      setViewCardsError(null);
      setViewCardsLoading(false);
      return;
    }

    let cancelled = false;
    setViewCardsLoading(true);
    setViewCardsError(null);
    setViewCards([]);

    void fetchDm2CardsForCardSet(viewCardsRow.id).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setViewCardsError(result.error);
        setViewCards([]);
      } else {
        setViewCards(
          sortDm2CardsByParallelThenNumber(result.cards ?? [])
        );
      }
      setViewCardsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [viewCardsRow]);

  const viewCardsPageCount = Math.max(
    1,
    Math.ceil(viewCards.length / CARD_SET_CARDS_PAGE_SIZE)
  );
  const effectiveViewCardsPage = Math.min(viewCardsPage, viewCardsPageCount - 1);
  const viewCardsPageRows = viewCards.slice(
    effectiveViewCardsPage * CARD_SET_CARDS_PAGE_SIZE,
    (effectiveViewCardsPage + 1) * CARD_SET_CARDS_PAGE_SIZE
  );

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const sportCompare = a.sportName.localeCompare(b.sportName);
        if (sportCompare !== 0) return sportCompare;
        const mfrCompare = a.manufacturerName.localeCompare(b.manufacturerName);
        if (mfrCompare !== 0) return mfrCompare;
        const brandCompare = a.brandName.localeCompare(b.brandName);
        if (brandCompare !== 0) return brandCompare;
        const categoryCompare = a.cardSetCategoryName.localeCompare(
          b.cardSetCategoryName
        );
        if (categoryCompare !== 0) return categoryCompare;
        return a.cardSetName.localeCompare(b.cardSetName);
      }),
    [rows]
  );
  const cardSetGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        sportName: string;
        year: number;
        manufacturerName: string;
        brandName: string;
        sets: Dm2CardSet[];
        cardSetNameCount: number;
        totalCards: number;
      }
    >();

    for (const row of sortedRows) {
      const key = `${row.sportName}|${row.year}|${row.manufacturerName}|${row.brandName}`;
      const existing = groups.get(key);
      if (existing) {
        existing.sets.push(row);
      } else {
        groups.set(key, {
          key,
          sportName: row.sportName,
          year: row.year,
          manufacturerName: row.manufacturerName,
          brandName: row.brandName,
          sets: [row],
          cardSetNameCount: 0,
          totalCards: 0,
        });
      }
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        cardSetNameCount: new Set(group.sets.map((set) => set.cardSetNameId))
          .size,
        totalCards: group.sets.reduce(
          (sum, set) => sum + (cardCountsBySetId[set.id] ?? 0),
          0
        ),
      }))
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const sportCompare = a.sportName.localeCompare(b.sportName);
        if (sportCompare !== 0) return sportCompare;
        const mfrCompare = a.manufacturerName.localeCompare(b.manufacturerName);
        if (mfrCompare !== 0) return mfrCompare;
        return a.brandName.localeCompare(b.brandName);
      });
  }, [sortedRows, cardCountsBySetId]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const sortedSports = useMemo(
    () => sortPickListOptions(sports),
    [sports]
  );
  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name)),
    [brands]
  );
  const sortedCategories = useMemo(
    () => [...cardSetCategories].sort((a, b) => a.name.localeCompare(b.name)),
    [cardSetCategories]
  );
  const sortedCardSetNames = useMemo(
    () => [...cardSetNames].sort((a, b) => a.name.localeCompare(b.name)),
    [cardSetNames]
  );
  const sortedParallels = useMemo(
    () => [...parallels].sort((a, b) => a.name.localeCompare(b.name)),
    [parallels]
  );
  const sortedActiveAttributes = useMemo(
    () =>
      [...attributes]
        .filter((attribute) => attribute.active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [attributes]
  );
  const activeCount = sortedRows.filter((row) => row.active).length;

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

  function formatBrandLabel(brand: Dm2Brand): string {
    return `${brand.manufacturerName} | ${brand.name}`;
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 className="text-sm font-medium">Card Set</h3>
              <p className="text-xs text-muted-foreground">
                {activeCount} active · {sortedRows.length} total
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="border-t border-border/80 bg-background px-4 py-3">
            {sortedRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No card sets yet. Add one below.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[1%]" />
                    <TableHead>Sport</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Manufacturer | Brand</TableHead>
                    <TableHead className="text-right">Card Set Names</TableHead>
                    <TableHead className="text-right">Cards</TableHead>
                    <TableHead className="text-right w-[1%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cardSetGroups.map((group) => {
                    const expanded = expandedGroups.has(group.key);
                    return (
                      <CardSetGroupRows
                        key={group.key}
                        group={group}
                        expanded={expanded}
                        onToggle={() => toggleGroup(group.key)}
                        cardCountsBySetId={cardCountsBySetId}
                        cardCountsLoading={cardCountsLoading}
                        pending={pending}
                        onViewCards={(row) => {
                          setViewCardsRow(row);
                          setViewCardsPage(0);
                        }}
                        onEdit={(row) => {
                          setEditRow(row);
                          setEditSportId(row.sportId);
                          setEditYear(String(row.year));
                          setEditBrandId(row.brandId);
                          setEditCategoryId(row.cardSetCategoryId);
                          setEditCardSetNameId(row.cardSetNameId);
                          setError(null);
                        }}
                        onDelete={(row) => {
                          setDeleteRow(row);
                          setError(null);
                        }}
                        runAction={runAction}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <form
              className="mt-4 grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                const year = Number(newYear);
                runAction(
                  () =>
                    createDm2CardSet({
                      sportId: newSportId,
                      year,
                      brandId: newBrandId,
                      cardSetCategoryId: newCategoryId,
                      cardSetNameId: newCardSetNameId,
                    }),
                  () => {
                    setNewSportId("");
                    setNewYear("");
                    setNewBrandId("");
                    setNewCategoryId("");
                    setNewCardSetNameId("");
                  }
                );
              }}
            >
              <div className="space-y-2">
                <Label>Sport</Label>
                <Select
                  value={newSportId}
                  onValueChange={(value) => value && setNewSportId(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedSports.map((sport) => (
                      <SelectItem key={sport.id} value={sport.id}>
                        {sport.label}
                        {!sport.active ? " (Inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-card-set-year">Year</Label>
                <Input
                  id="add-card-set-year"
                  type="number"
                  min={1800}
                  max={2100}
                  value={newYear}
                  onChange={(event) => setNewYear(event.target.value)}
                  placeholder="2024"
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label>Manufacturer | Brand</Label>
                <Select
                  value={newBrandId}
                  onValueChange={(value) => value && setNewBrandId(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedBrands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {formatBrandLabel(brand)}
                        {!brand.active ? " (Inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Card Set Category</Label>
                <Select
                  value={newCategoryId}
                  onValueChange={(value) => value && setNewCategoryId(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                        {!category.active ? " (Inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Card Set Name</Label>
                <Select
                  value={newCardSetNameId}
                  onValueChange={(value) => value && setNewCardSetNameId(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select card set name" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedCardSetNames.map((cardSetName) => (
                      <SelectItem key={cardSetName.id} value={cardSetName.id}>
                        {cardSetName.name}
                        {!cardSetName.active ? " (Inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="gap-2"
                disabled={
                  pending ||
                  !newSportId ||
                  !newYear.trim() ||
                  !newBrandId ||
                  !newCategoryId ||
                  !newCardSetNameId
                }
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>

            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}
          </div>
        </details>
      </section>

      <Dialog
        open={editRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditRow(null);
            setEditSportId("");
            setEditYear("");
            setEditBrandId("");
            setEditCategoryId("");
            setEditCardSetNameId("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit card set</DialogTitle>
            <DialogDescription>
              Update the linked sport, year, brand, category, and card set name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select
                value={editSportId}
                onValueChange={(value) => value && setEditSportId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select sport" />
                </SelectTrigger>
                <SelectContent>
                  {sortedSports.map((sport) => (
                    <SelectItem key={sport.id} value={sport.id}>
                      {sport.label}
                      {!sport.active ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-card-set-year">Year</Label>
              <Input
                id="edit-card-set-year"
                type="number"
                min={1800}
                max={2100}
                value={editYear}
                onChange={(event) => setEditYear(event.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Manufacturer | Brand</Label>
              <Select
                value={editBrandId}
                onValueChange={(value) => value && setEditBrandId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {sortedBrands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {formatBrandLabel(brand)}
                      {!brand.active ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Card Set Category</Label>
              <Select
                value={editCategoryId}
                onValueChange={(value) => value && setEditCategoryId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {sortedCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                      {!category.active ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Card Set Name</Label>
              <Select
                value={editCardSetNameId}
                onValueChange={(value) => value && setEditCardSetNameId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select card set name" />
                </SelectTrigger>
                <SelectContent>
                  {sortedCardSetNames.map((cardSetName) => (
                    <SelectItem key={cardSetName.id} value={cardSetName.id}>
                      {cardSetName.name}
                      {!cardSetName.active ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRow(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                pending ||
                !editSportId ||
                !editYear.trim() ||
                !editBrandId ||
                !editCategoryId ||
                !editCardSetNameId ||
                !editRow
              }
              onClick={() => {
                if (!editRow) return;
                runAction(
                  () =>
                    updateDm2CardSet({
                      id: editRow.id,
                      sportId: editSportId,
                      year: Number(editYear),
                      brandId: editBrandId,
                      cardSetCategoryId: editCategoryId,
                      cardSetNameId: editCardSetNameId,
                    }),
                  () => setEditRow(null)
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteRow != null}
        onOpenChange={(open) => {
          if (!open) setDeleteRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete card set</DialogTitle>
            <DialogDescription>
              Delete the {deleteRow?.year} {deleteRow?.sportName} card set (
              {deleteRow?.cardSetName})? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRow(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !deleteRow}
              onClick={() => {
                if (!deleteRow) return;
                runAction(
                  () => deleteDm2CardSet(deleteRow.id),
                  () => setDeleteRow(null)
                );
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewCardsRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setViewCardsRow(null);
            setViewCardsPage(0);
            setViewCardsError(null);
            setEditCardRow(null);
            setImageCardRow(null);
            setDeleteImageCardRow(null);
            setAddAttributeCardRow(null);
            setEditAttributeCardRow(null);
            setDeleteAttributeCardRow(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cards in set</DialogTitle>
            <DialogDescription>
              {viewCardsRow
                ? formatCardSetOptionLabel(viewCardsRow)
                : "Card set cards"}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {viewCardsLoading ? (
              <p className="text-sm text-muted-foreground">Loading cards…</p>
            ) : viewCardsError ? (
              <p className="text-sm text-destructive">{viewCardsError}</p>
            ) : viewCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cards in this set yet.
              </p>
            ) : (
              <>
                <div className="max-h-[min(60vh,520px)] overflow-auto rounded-lg border border-border/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[52px]">Image</TableHead>
                        <TableHead>Card #</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Parallel</TableHead>
                        <TableHead>Attributes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewCardsPageRows.map((card) => {
                        const imageUrl = getDm2CardImageUrl(card.imagePath);
                        return (
                        <TableRow
                          key={card.id}
                          className={cn(!card.active && "opacity-70")}
                        >
                          <TableCell>
                            <div className="relative h-12 w-9 overflow-hidden rounded-md border border-border/80 bg-muted">
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={`${card.player} card image`}
                                  fill
                                  className="object-contain p-0.5"
                                  sizes="36px"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                  <span className="text-xs font-semibold opacity-30">
                                    {card.player.charAt(0)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium tabular-nums">
                            {card.cardNumber}
                          </TableCell>
                          <TableCell>{card.player}</TableCell>
                          <TableCell>{card.parallelName ?? "—"}</TableCell>
                          <TableCell>
                            {card.attributes.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {card.attributes.map((attribute) => (
                                  <Badge
                                    key={attribute.id}
                                    variant="secondary"
                                    className="text-[10px] font-normal"
                                  >
                                    {attribute.attributeName}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={card.active ? "secondary" : "outline"}>
                              {card.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="outline-none"
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label={`Actions for ${card.player}`}
                                    disabled={cardsPending}
                                  />
                                }
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => {
                                      setEditCardRow(card);
                                      setEditCardNumber(card.cardNumber);
                                      setEditPlayerIds(card.playerIds);
                                      setEditPlayerQuery("");
                                      setEditParallelId(parallelSelectValue(card.parallelId));
                                      setViewCardsError(null);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() =>
                                      void runCardsAction(() =>
                                        setDm2CardActive({
                                          id: card.id,
                                          active: !card.active,
                                        })
                                      )
                                    }
                                  >
                                    {card.active ? (
                                      <PowerOff className="h-4 w-4" />
                                    ) : (
                                      <Power className="h-4 w-4" />
                                    )}
                                    {card.active ? "Inactivate" : "Activate"}
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                  {card.imagePath ? (
                                    <>
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() => openImageDialog(card)}
                                      >
                                        <ImageIcon className="h-4 w-4" />
                                        Update image
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="cursor-pointer text-destructive"
                                        onClick={() => setDeleteImageCardRow(card)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Delete image
                                      </DropdownMenuItem>
                                    </>
                                  ) : (
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      onClick={() => openImageDialog(card)}
                                    >
                                      <ImagePlus className="h-4 w-4" />
                                      Add image
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => openAddAttributeDialog(card)}
                                  >
                                    <Plus className="h-4 w-4" />
                                    Add attribute
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    disabled={card.attributes.length === 0}
                                    onClick={() => {
                                      const assignment = card.attributes[0];
                                      if (!assignment) return;
                                      openEditAttributeDialog(card, assignment);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit attribute
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer text-destructive"
                                    disabled={card.attributes.length === 0}
                                    onClick={() => openDeleteAttributeDialog(card)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete attribute
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {viewCards.length <= CARD_SET_CARDS_PAGE_SIZE
                      ? `${viewCards.length} card${viewCards.length === 1 ? "" : "s"}`
                      : `Showing cards ${effectiveViewCardsPage * CARD_SET_CARDS_PAGE_SIZE + 1}–${Math.min(
                          (effectiveViewCardsPage + 1) * CARD_SET_CARDS_PAGE_SIZE,
                          viewCards.length
                        )} of ${viewCards.length}`}
                  </p>
                  {viewCards.length > CARD_SET_CARDS_PAGE_SIZE && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={effectiveViewCardsPage === 0}
                        onClick={() =>
                          setViewCardsPage((page) => Math.max(0, page - 1))
                        }
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {effectiveViewCardsPage + 1} of {viewCardsPageCount}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={effectiveViewCardsPage >= viewCardsPageCount - 1}
                        onClick={() =>
                          setViewCardsPage((page) =>
                            Math.min(viewCardsPageCount - 1, page + 1)
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewCardsRow(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editCardRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditCardRow(null);
            setEditCardNumber("");
            setEditPlayerIds([]);
            setEditPlayerQuery("");
            setEditParallelId(NONE_PARALLEL_VALUE);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
            <DialogDescription>
              Update card number, linked players, or parallel for this catalog entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-card-number">Card #</Label>
              <Input
                id="edit-card-number"
                value={editCardNumber}
                onChange={(event) => setEditCardNumber(event.target.value)}
                maxLength={100}
                disabled={cardsPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-card-player">Players</Label>
              <div className="flex flex-wrap gap-1">
                {editPlayerIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Select at least one player in this sport.
                  </p>
                ) : (
                  players
                    .filter((player) => editPlayerIds.includes(player.id))
                    .map((player) => (
                      <Badge key={player.id} variant="secondary">
                        {player.name}
                        <button
                          type="button"
                          className="ml-1"
                          disabled={cardsPending}
                          onClick={() =>
                            setEditPlayerIds((current) =>
                              current.filter((id) => id !== player.id)
                            )
                          }
                        >
                          ×
                        </button>
                      </Badge>
                    ))
                )}
              </div>
              <Input
                id="edit-card-player"
                value={editPlayerQuery}
                onChange={(event) => setEditPlayerQuery(event.target.value)}
                placeholder="Search players"
                disabled={cardsPending}
              />
              <div className="max-h-40 overflow-auto rounded-md border">
                {players
                  .filter(
                    (player) =>
                      player.active &&
                      player.sportId === viewCardsRow?.sportId &&
                      (!editPlayerQuery.trim() ||
                        player.name
                          .toLowerCase()
                          .includes(editPlayerQuery.trim().toLowerCase()))
                  )
                  .slice(0, 40)
                  .map((player) => {
                    const selected = editPlayerIds.includes(player.id);
                    return (
                      <button
                        key={player.id}
                        type="button"
                        disabled={cardsPending}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() =>
                          setEditPlayerIds((current) =>
                            selected
                              ? current.filter((id) => id !== player.id)
                              : [...current, player.id]
                          )
                        }
                      >
                        <span>{player.name}</span>
                        {selected ? (
                          <span className="text-xs text-muted-foreground">Added</span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-card-parallel">Parallel</Label>
              <Select
                value={editParallelId}
                onValueChange={(value) => value && setEditParallelId(value)}
                disabled={cardsPending}
              >
                <SelectTrigger id="edit-card-parallel" className="w-full">
                  <SelectValue placeholder="Select parallel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_PARALLEL_VALUE}>None</SelectItem>
                  {sortedParallels.map((parallel) => (
                    <SelectItem key={parallel.id} value={parallel.id}>
                      {parallel.name}
                      {!parallel.active ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCardRow(null)}
              disabled={cardsPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                cardsPending ||
                !editCardRow ||
                !editCardNumber.trim() ||
                editPlayerIds.length === 0
              }
              onClick={() => {
                if (!editCardRow || !viewCardsRow) return;
                void runCardsAction(
                  () =>
                    updateDm2Card({
                      id: editCardRow.id,
                      cardSetId: viewCardsRow.id,
                      cardNumber: editCardNumber,
                      playerIds: editPlayerIds,
                      parallelId: parallelIdFromSelect(editParallelId),
                    }),
                  () => setEditCardRow(null)
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={imageCardRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setImageCardRow(null);
            setImageFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {imageCardRow?.imagePath ? "Update card image" : "Add card image"}
            </DialogTitle>
            <DialogDescription>
              {imageCardRow
                ? `Upload a catalog image for ${imageCardRow.player} (#${imageCardRow.cardNumber}).`
                : "Upload a catalog image for this card."}
            </DialogDescription>
          </DialogHeader>
          <ImageUpload
            key={imageCardRow?.id ?? "new-image"}
            currentImageUrl={getDm2CardImageUrl(imageCardRow?.imagePath ?? null)}
            onFileSelect={setImageFile}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImageCardRow(null);
                setImageFile(null);
              }}
              disabled={cardsPending}
            >
              Cancel
            </Button>
            <Button
              disabled={cardsPending || !imageCardRow || !imageFile}
              onClick={() => {
                if (!imageCardRow || !imageFile) return;
                const formData = new FormData();
                formData.set("file", imageFile);
                void runCardsAction(
                  () => uploadDm2CardImage(imageCardRow.id, formData),
                  () => {
                    setImageCardRow(null);
                    setImageFile(null);
                  }
                );
              }}
            >
              Save image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteImageCardRow != null}
        onOpenChange={(open) => {
          if (!open) setDeleteImageCardRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete card image</DialogTitle>
            <DialogDescription>
              Remove the catalog image for {deleteImageCardRow?.player}? The card
              entry will remain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteImageCardRow(null)}
              disabled={cardsPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={cardsPending || !deleteImageCardRow}
              onClick={() => {
                if (!deleteImageCardRow) return;
                void runCardsAction(
                  () => deleteDm2CardImage(deleteImageCardRow.id),
                  () => setDeleteImageCardRow(null)
                );
              }}
            >
              Delete image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addAttributeCardRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setAddAttributeCardRow(null);
            setAddAttributeId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add attribute</DialogTitle>
            <DialogDescription>
              Assign an attribute tag to {addAttributeCardRow?.player} (#
              {addAttributeCardRow?.cardNumber}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="add-card-attribute">Attribute</Label>
            <Select
              value={addAttributeId}
              onValueChange={(value) => value && setAddAttributeId(value)}
              disabled={cardsPending}
            >
              <SelectTrigger id="add-card-attribute" className="w-full">
                <SelectValue placeholder="Select attribute" />
              </SelectTrigger>
              <SelectContent>
                {sortedActiveAttributes
                  .filter(
                    (attribute) =>
                      !addAttributeCardRow?.attributes.some(
                        (assigned) => assigned.attributeId === attribute.id
                      )
                  )
                  .map((attribute) => (
                    <SelectItem key={attribute.id} value={attribute.id}>
                      {attribute.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddAttributeCardRow(null);
                setAddAttributeId("");
              }}
              disabled={cardsPending}
            >
              Cancel
            </Button>
            <Button
              disabled={cardsPending || !addAttributeCardRow || !addAttributeId}
              onClick={() => {
                if (!addAttributeCardRow || !addAttributeId) return;
                void runCardsAction(
                  () =>
                    assignDm2CardAttribute({
                      cardId: addAttributeCardRow.id,
                      attributeId: addAttributeId,
                    }),
                  () => {
                    setAddAttributeCardRow(null);
                    setAddAttributeId("");
                  }
                );
              }}
            >
              Add attribute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editAttributeCardRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditAttributeCardRow(null);
            setEditAttributeAssignment(null);
            setEditAttributeId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit attribute</DialogTitle>
            <DialogDescription>
              Change an assigned attribute for {editAttributeCardRow?.player} (#
              {editAttributeCardRow?.cardNumber}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(editAttributeCardRow?.attributes.length ?? 0) > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="edit-card-attribute-assignment">Current attribute</Label>
                <Select
                  value={editAttributeAssignment?.id ?? ""}
                  onValueChange={(value) => {
                    const assignment = editAttributeCardRow?.attributes.find(
                      (row) => row.id === value
                    );
                    setEditAttributeAssignment(assignment ?? null);
                    setEditAttributeId(assignment?.attributeId ?? "");
                  }}
                  disabled={cardsPending}
                >
                  <SelectTrigger id="edit-card-attribute-assignment" className="w-full">
                    <SelectValue placeholder="Select assigned attribute" />
                  </SelectTrigger>
                  <SelectContent>
                    {editAttributeCardRow?.attributes.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.attributeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="edit-card-attribute">New attribute</Label>
              <Select
                value={editAttributeId}
                onValueChange={(value) => value && setEditAttributeId(value)}
                disabled={cardsPending}
              >
                <SelectTrigger id="edit-card-attribute" className="w-full">
                  <SelectValue placeholder="Select attribute" />
                </SelectTrigger>
                <SelectContent>
                  {sortedActiveAttributes
                    .filter(
                      (attribute) =>
                        attribute.id === editAttributeId ||
                        !editAttributeCardRow?.attributes.some(
                          (assigned) =>
                            assigned.attributeId === attribute.id &&
                            assigned.id !== editAttributeAssignment?.id
                        )
                    )
                    .map((attribute) => (
                      <SelectItem key={attribute.id} value={attribute.id}>
                        {attribute.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditAttributeCardRow(null);
                setEditAttributeAssignment(null);
                setEditAttributeId("");
              }}
              disabled={cardsPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                cardsPending ||
                !editAttributeCardRow ||
                !editAttributeAssignment ||
                !editAttributeId ||
                editAttributeId === editAttributeAssignment.attributeId
              }
              onClick={() => {
                if (
                  !editAttributeCardRow ||
                  !editAttributeAssignment ||
                  !editAttributeId
                ) {
                  return;
                }
                void runCardsAction(
                  () =>
                    updateDm2CardAttribute({
                      id: editAttributeAssignment.id,
                      attributeId: editAttributeId,
                    }),
                  () => {
                    setEditAttributeCardRow(null);
                    setEditAttributeAssignment(null);
                    setEditAttributeId("");
                  }
                );
              }}
            >
              Save attribute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteAttributeCardRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteAttributeCardRow(null);
            setDeleteAttributeAssignmentId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete attribute</DialogTitle>
            <DialogDescription>
              Remove an attribute tag from {deleteAttributeCardRow?.player} (#
              {deleteAttributeCardRow?.cardNumber}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-card-attribute">Attribute to remove</Label>
            <Select
              value={deleteAttributeAssignmentId}
              onValueChange={(value) => value && setDeleteAttributeAssignmentId(value)}
              disabled={cardsPending}
            >
              <SelectTrigger id="delete-card-attribute" className="w-full">
                <SelectValue placeholder="Select attribute" />
              </SelectTrigger>
              <SelectContent>
                {deleteAttributeCardRow?.attributes.map((assignment) => (
                  <SelectItem key={assignment.id} value={assignment.id}>
                    {assignment.attributeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteAttributeCardRow(null);
                setDeleteAttributeAssignmentId("");
              }}
              disabled={cardsPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={cardsPending || !deleteAttributeAssignmentId}
              onClick={() => {
                if (!deleteAttributeAssignmentId) return;
                void runCardsAction(
                  () => removeDm2CardAttribute(deleteAttributeAssignmentId),
                  () => {
                    setDeleteAttributeCardRow(null);
                    setDeleteAttributeAssignmentId("");
                  }
                );
              }}
            >
              Delete attribute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
