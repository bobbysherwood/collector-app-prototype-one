"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
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
  createDm2Brand,
  createDm2CardSet,
  createDm2CardSetCategory,
  createDm2CardSetName,
  createDm2Manufacturer,
  createDm2Parallel,
  deleteDm2Brand,
  deleteDm2CardSet,
  deleteDm2CardSetCategory,
  deleteDm2CardSetName,
  deleteDm2Manufacturer,
  deleteDm2Parallel,
  setDm2BrandActive,
  setDm2CardSetActive,
  setDm2CardSetCategoryActive,
  setDm2CardSetNameActive,
  setDm2ManufacturerActive,
  setDm2ParallelActive,
  updateDm2Brand,
  updateDm2CardSet,
  updateDm2CardSetCategory,
  updateDm2CardSetName,
  updateDm2Manufacturer,
  updateDm2Parallel,
  fetchDm2CardsForCardSet,
} from "@/app/actions/data-model-v2";
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
import { sortPickListOptions } from "@/lib/pick-list-utils";
import { cn } from "@/lib/utils";
import type {
  Dm2Brand,
  Dm2Card,
  Dm2CardSet,
  Dm2CardSetCategory,
  Dm2CardSetName,
  Dm2Manufacturer,
  Dm2Parallel,
} from "@/types/data-model-v2";
import type { PickListOption } from "@/types/pick-list";
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
  cardSets,
  cardCountsBySetId,
}: {
  sports: PickListOption[];
  cardSetCategories: Dm2CardSetCategory[];
  cardSetNames: Dm2CardSetName[];
  manufacturers: Dm2Manufacturer[];
  brands: Dm2Brand[];
  parallels: Dm2Parallel[];
  cardSets: Dm2CardSet[];
  cardCountsBySetId: Record<string, number>;
}) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOption, setEditOption] = useState<PickListOption | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deleteOption, setDeleteOption] = useState<PickListOption | null>(null);

  const sortedSports = useMemo(() => sortPickListOptions(sports), [sports]);
  const activeCount = sortedSports.filter((row) => row.active).length;

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
      <CardSetSection
        rows={cardSets}
        cardCountsBySetId={cardCountsBySetId}
        sports={sports}
        brands={brands}
        cardSetCategories={cardSetCategories}
        cardSetNames={cardSetNames}
      />
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

function formatCardSetOptionLabel(cardSet: Dm2CardSet): string {
  return `${cardSet.year} ${cardSet.sportName} · ${cardSet.manufacturerName} | ${cardSet.brandName} · ${cardSet.cardSetName}`;
}

const CARD_SET_CARDS_PAGE_SIZE = 500;

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

function CardSetSection({
  rows,
  cardCountsBySetId,
  sports,
  brands,
  cardSetCategories,
  cardSetNames,
}: {
  rows: Dm2CardSet[];
  cardCountsBySetId: Record<string, number>;
  sports: PickListOption[];
  brands: Dm2Brand[];
  cardSetCategories: Dm2CardSetCategory[];
  cardSetNames: Dm2CardSetName[];
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
        return a.sportName.localeCompare(b.sportName);
      }),
    [rows]
  );
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
                    <TableHead>Sport</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Manufacturer | Brand</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Card Set Name</TableHead>
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
                      <TableCell>{row.sportName}</TableCell>
                      <TableCell className="tabular-nums">{row.year}</TableCell>
                      <TableCell>
                        {row.manufacturerName} | {row.brandName}
                      </TableCell>
                      <TableCell>{row.cardSetCategoryName}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left text-primary underline-offset-4 hover:underline"
                          onClick={() => {
                            setViewCardsRow(row);
                            setViewCardsPage(0);
                          }}
                        >
                          {row.cardSetName}
                        </button>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({cardCountsBySetId[row.id] ?? 0} cards)
                        </span>
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
                                aria-label={`Actions for ${row.year} ${row.sportName} card set`}
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
                                  setEditSportId(row.sportId);
                                  setEditYear(String(row.year));
                                  setEditBrandId(row.brandId);
                                  setEditCategoryId(row.cardSetCategoryId);
                                  setEditCardSetNameId(row.cardSetNameId);
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
                        <TableHead>Card #</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Parallel</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewCardsPageRows.map((card) => (
                        <TableRow
                          key={card.id}
                          className={cn(!card.active && "opacity-70")}
                        >
                          <TableCell className="font-medium tabular-nums">
                            {card.cardNumber}
                          </TableCell>
                          <TableCell>{card.player}</TableCell>
                          <TableCell>{card.parallelName ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={card.active ? "secondary" : "outline"}>
                              {card.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
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
    </>
  );
}
