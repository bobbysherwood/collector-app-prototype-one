"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  autoConfirmReadyCardSetGroups,
  buildCardSetGroups,
  CARD_SET_GROUP_FIELDS,
  cardSetFieldLabel,
  countPendingCardSetGroups,
  findCardSetCatalogMatch,
  formatCardSetGroupLabel,
  getCardSetFieldOptions,
  isCardSetGroupReady,
  updateCardSetGroupField,
  type CardSetGroupField,
  type CardSetReviewAction,
} from "@/lib/dm2-import-card-sets";
import { cn } from "@/lib/utils";
import type { Dm2ImportSession } from "@/types/dm2-import";

const EMPTY_SELECT = "__none__";

type CardSetFieldFilter = "all" | "pending" | CardSetGroupField;

export function Dm2ImportReviewCardSets({
  session,
  actions,
  fieldFilter,
  onActionsChange,
  onFieldFilterChange,
  onSessionChange,
}: {
  session: Dm2ImportSession;
  actions: Record<string, CardSetReviewAction>;
  fieldFilter: CardSetFieldFilter;
  onActionsChange: (actions: Record<string, CardSetReviewAction>) => void;
  onFieldFilterChange: (filter: CardSetFieldFilter) => void;
  onSessionChange: (updater: (session: Dm2ImportSession) => Dm2ImportSession) => void;
}) {
  const groups = buildCardSetGroups(session.rows);
  const pendingCount = countPendingCardSetGroups(groups, actions);

  const filteredGroups = groups.filter((group) => {
    if (fieldFilter === "all") return true;
    if (fieldFilter === "pending") {
      return (
        group.missingFields.length > 0 || (actions[group.id] ?? "pending") !== "confirmed"
      );
    }
    return group.missingFields.includes(fieldFilter);
  });

  const fieldStats = CARD_SET_GROUP_FIELDS.map((field) => ({
    field,
    pending: groups.filter((group) => group.missingFields.includes(field)).length,
  })).filter((stat) => stat.pending > 0);

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Confirm each card set combination has sport, year, manufacturer, brand, category,
        and set name mapped correctly. Changes apply to all cards in the set.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onActionsChange(autoConfirmReadyCardSetGroups(groups, actions))
          }
        >
          Confirm all complete card sets
        </Button>
        <p className="self-center text-xs text-muted-foreground">
          {pendingCount} card set(s) still need confirmation
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={fieldFilter === "all" ? "default" : "outline"}
          onClick={() => onFieldFilterChange("all")}
        >
          All
          <span className="ml-1.5 text-xs opacity-80">
            {pendingCount} pending / {groups.length}
          </span>
        </Button>
        <Button
          size="sm"
          variant={fieldFilter === "pending" ? "default" : "outline"}
          onClick={() => onFieldFilterChange("pending")}
        >
          Pending
          <span
            className={cn(
              "ml-1.5 text-xs",
              pendingCount > 0
                ? fieldFilter === "pending"
                  ? "opacity-90"
                  : "text-destructive"
                : "opacity-80"
            )}
          >
            {pendingCount}
          </span>
        </Button>
        {fieldStats.map((stat) => (
          <Button
            key={stat.field}
            size="sm"
            variant={fieldFilter === stat.field ? "default" : "outline"}
            onClick={() => onFieldFilterChange(stat.field)}
          >
            Missing {cardSetFieldLabel(stat.field)}
            <span className="ml-1.5 text-xs text-destructive">{stat.pending}</span>
          </Button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Card Set</TableHead>
            <TableHead>Sport</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Manufacturer</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Set Name</TableHead>
            <TableHead>Refs</TableHead>
            <TableHead>Match</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredGroups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                No card sets match this filter.
              </TableCell>
            </TableRow>
          ) : (
            filteredGroups.map((group) => {
              const match = findCardSetCatalogMatch(session, group);
              const action = actions[group.id] ?? "pending";
              const ready = isCardSetGroupReady(group);

              return (
                <TableRow
                  key={group.id}
                  className={cn(!ready && "bg-destructive/5")}
                >
                  <TableCell className="min-w-[180px] text-xs font-medium">
                    {formatCardSetGroupLabel(group)}
                  </TableCell>
                  {CARD_SET_GROUP_FIELDS.map((field) => (
                    <TableCell key={field}>
                      <CardSetFieldEditor
                        session={session}
                        group={group}
                        field={field}
                        missing={group.missingFields.includes(field)}
                        onSessionChange={onSessionChange}
                      />
                    </TableCell>
                  ))}
                  <TableCell>{group.referenceCount}</TableCell>
                  <TableCell className="text-xs">
                    {match.detail}
                    {match.matched && (
                      <Badge variant="secondary" className="ml-1">
                        Catalog
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={action}
                      onValueChange={(value) => {
                        if (!value) return;
                        onActionsChange({
                          ...actions,
                          [group.id]: value as CardSetReviewAction,
                        });
                      }}
                      disabled={!ready}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Review</SelectItem>
                        <SelectItem value="confirmed">Confirm</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function CardSetFieldEditor({
  session,
  group,
  field,
  missing,
  onSessionChange,
}: {
  session: Dm2ImportSession;
  group: ReturnType<typeof buildCardSetGroups>[number];
  field: CardSetGroupField;
  missing: boolean;
  onSessionChange: (updater: (session: Dm2ImportSession) => Dm2ImportSession) => void;
}) {
  const value =
    field === "year"
      ? group.year?.toString() ?? ""
      : ((group[field] as string | undefined) ?? "");
  const options = getCardSetFieldOptions(session, field, group);

  if (field === "year") {
    return (
      <Input
        defaultValue={value}
        key={`${group.id}-${field}-${value}`}
        type="number"
        className={cn("h-8 w-[72px] text-xs", missing && "border-destructive text-destructive")}
        onBlur={(event) => {
          if (event.target.value === value) return;
          onSessionChange((current) =>
            updateCardSetGroupField(current, group, field, event.target.value)
          );
        }}
      />
    );
  }

  return (
    <Select
      value={value || EMPTY_SELECT}
      onValueChange={(nextValue) => {
        const trimmed = nextValue === EMPTY_SELECT ? "" : nextValue ?? "";
        if (trimmed === value) return;
        onSessionChange((current) =>
          updateCardSetGroupField(current, group, field, trimmed)
        );
      }}
    >
      <SelectTrigger
        className={cn(
          "h-8 min-w-[100px] text-xs",
          missing && "border-destructive text-destructive"
        )}
      >
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_SELECT}>—</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
