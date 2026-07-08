"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ClipboardList,
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
import type {
  AdminPickLists,
  PickListCategory,
  PickListOption,
} from "@/types/pick-list";
import {
  PICK_LIST_CATEGORIES_ALPHABETICAL,
  PICK_LIST_CATEGORY_LABELS,
} from "@/types/pick-list";
import { sortGradePickListOptions, sortPickListOptions } from "@/lib/pick-list-utils";
import { cn } from "@/lib/utils";

function PickListCategorySection({
  category,
  options,
}: {
  category: PickListCategory;
  options: PickListOption[];
}) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOption, setEditOption] = useState<PickListOption | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deleteOption, setDeleteOption] = useState<PickListOption | null>(null);

  const sortedOptions = useMemo(
    () =>
      category === "grade"
        ? sortGradePickListOptions(options)
        : sortPickListOptions(options),
    [category, options]
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

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-sm font-medium">
              {PICK_LIST_CATEGORY_LABELS[category]}
            </h3>
            <p className="text-xs text-muted-foreground">
              {sortedOptions.filter((option) => option.active).length} active ·{" "}
              {sortedOptions.length} total
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="border-t border-border/80 bg-background px-4 py-3">
        {sortedOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No options yet. Add one below.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Option</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOptions.map((option) => (
                <TableRow
                  key={option.id}
                  className={cn(!option.active && "opacity-70")}
                >
                  <TableCell className="font-medium">{option.label}</TableCell>
                  <TableCell>
                    <Badge variant={option.active ? "secondary" : "outline"}>
                      {option.active ? "Active" : "Inactive"}
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
                            aria-label={`Actions for ${option.label}`}
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
                              setEditOption(option);
                              setEditLabel(option.label);
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
                                  id: option.id,
                                  active: !option.active,
                                })
                              )
                            }
                          >
                            {option.active ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                            {option.active ? "Inactivate" : "Activate"}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive"
                          onClick={() => {
                            setDeleteOption(option);
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
                  category,
                  label: newLabel,
                }),
              () => setNewLabel("")
            );
          }}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor={`add-${category}`}>Add option</Label>
            <Input
              id={`add-${category}`}
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder={`New ${PICK_LIST_CATEGORY_LABELS[category].toLowerCase()} option`}
              disabled={pending}
            />
          </div>
          <Button type="submit" className="gap-2" disabled={pending || !newLabel.trim()}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </div>
      </details>

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
            <DialogTitle>Edit option</DialogTitle>
            <DialogDescription>
              Update the label shown in Add/Edit Asset dropdowns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-pick-list-label">Label</Label>
            <Input
              id="edit-pick-list-label"
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
            <DialogTitle>Delete option</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteOption?.label}&quot; from the pick list? Existing
              assets that already use this value will keep it, but it will no longer
              appear in dropdowns.
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
    </section>
  );
}

export function AdminHoldingsPickListsPanel({
  initialPickLists,
}: {
  initialPickLists: AdminPickLists;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Holdings Pick Lists</h2>
          <p className="text-sm text-muted-foreground">
            Manage dropdown options for Card Type, Sport, Grader, and Grade on Add/Edit
            Asset screens
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {PICK_LIST_CATEGORIES_ALPHABETICAL.map((category) => (
          <PickListCategorySection
            key={category}
            category={category}
            options={initialPickLists[category]}
          />
        ))}
      </div>
    </div>
  );
}
