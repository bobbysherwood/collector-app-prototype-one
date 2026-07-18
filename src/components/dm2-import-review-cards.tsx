"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatCardSetRowLabel } from "@/lib/dm2-import-card-sets";
import {
  bulkUpdateDuplicateClusterParallel,
  bulkUpdateDuplicateIssueParallel,
  cardSetParallelKey,
  defaultKeepRowIdForDuplicateGroup,
  getBlockingRowIds,
  getDuplicateBulkParallelClusters,
  getDuplicateResolution,
  getDm2LookupFieldOptions,
  getRowMissingRequiredFields,
  isDuplicateIssue,
  resolveDuplicateGroup,
  updateDm2RowFields,
} from "@/lib/dm2-import-resolve";
import { cn } from "@/lib/utils";
import type { Dm2ExtractedRow, Dm2ImportIssue, Dm2ImportSession } from "@/types/dm2-import";

const EMPTY_SELECT = "__none__";
const PAGE_SIZE = 500;

export type CardReviewFilter =
  | "all"
  | "needs_review"
  | "blocking"
  | "duplicates"
  | "missing_fields";

function issueBadgeVariant(
  severity: "blocking" | "warning"
): "destructive" | "secondary" {
  return severity === "blocking" ? "destructive" : "secondary";
}

function getDuplicateRowIds(issues: Dm2ImportIssue[]): Set<string> {
  return new Set(
    issues
      .filter(isDuplicateIssue)
      .flatMap((issue) => issue.rowIds ?? [])
  );
}

function ParallelSelectCell({
  row,
  session,
  onSessionChange,
  disabled = false,
  highlightMissing = false,
}: {
  row: Dm2ExtractedRow;
  session: Dm2ImportSession;
  onSessionChange: (updater: (session: Dm2ImportSession) => Dm2ImportSession) => void;
  disabled?: boolean;
  highlightMissing?: boolean;
}) {
  const parallelOptions = getDm2LookupFieldOptions(session, "parallel", row);

  return (
    <Select
      value={row.parallel || EMPTY_SELECT}
      disabled={disabled}
      onValueChange={(nextValue) => {
        const trimmed = nextValue === EMPTY_SELECT ? "" : nextValue ?? "";
        if (trimmed === (row.parallel ?? "")) return;
        onSessionChange((current) =>
          updateDm2RowFields(current, row.id, { parallel: trimmed })
        );
      }}
    >
      <SelectTrigger
        className={cn(
          "h-8 min-w-[132px] text-xs",
          highlightMissing &&
            !row.parallel?.trim() &&
            "border-amber-500 text-amber-700 dark:text-amber-400"
        )}
      >
        <SelectValue placeholder="Add parallel…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_SELECT}>—</SelectItem>
        {parallelOptions.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DuplicateBulkParallelPanel({
  session,
  onSessionChange,
}: {
  session: Dm2ImportSession;
  onSessionChange: (updater: (session: Dm2ImportSession) => Dm2ImportSession) => void;
}) {
  const clusters = useMemo(
    () => getDuplicateBulkParallelClusters(session),
    [session]
  );
  const [selectedParallelByKey, setSelectedParallelByKey] = useState<
    Record<string, string>
  >({});
  const [includeAllRowsByKey, setIncludeAllRowsByKey] = useState<
    Record<string, boolean>
  >({});

  if (clusters.length === 0) return null;

  const sampleRow = session.rows.find((row) => !row.excluded);
  const defaultParallelOptions = sampleRow
    ? getDm2LookupFieldOptions(session, "parallel", sampleRow)
    : getDm2LookupFieldOptions(session, "parallel");

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3">
      <div>
        <h4 className="text-sm font-medium">Bulk parallel fix by card set</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Duplicate rows that share the same card set and parallel value can be
          updated together. This clears duplicate resolutions so groups can be
          re-evaluated after the fix.
        </p>
      </div>
      <div className="space-y-3">
        {clusters.map((cluster) => {
          const selectedParallel =
            selectedParallelByKey[cluster.key] ?? EMPTY_SELECT;
          const includeAllRows = includeAllRowsByKey[cluster.key] ?? false;
          const applyCount = includeAllRows
            ? cluster.totalMatchingRowCount
            : cluster.duplicateRowIds.length;

          return (
            <div
              key={cluster.key}
              className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/80 p-3 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <div className="min-w-[220px] flex-1 space-y-1">
                <p className="text-sm font-medium">{cluster.cardSetLabel}</p>
                <p className="text-xs text-muted-foreground">
                  Parallel: {cluster.parallelLabel} · {cluster.duplicateRowIds.length}{" "}
                  duplicate row(s) in {cluster.duplicateGroupCount} group
                  {cluster.duplicateGroupCount === 1 ? "" : "s"}
                  {cluster.totalMatchingRowCount > cluster.duplicateRowIds.length
                    ? ` · ${cluster.totalMatchingRowCount} total rows with this set + parallel`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-1">
                  {cluster.hasExactDuplicates && (
                    <Badge variant="secondary" className="text-[10px]">
                      Exact
                    </Badge>
                  )}
                  {cluster.hasNearDuplicates && (
                    <Badge variant="outline" className="text-[10px]">
                      Near
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex min-w-[180px] flex-col gap-1">
                <Label className="text-xs">Set parallel for {applyCount} row(s)</Label>
                <Select
                  value={selectedParallel}
                  onValueChange={(value) =>
                    setSelectedParallelByKey((current) => ({
                      ...current,
                      [cluster.key]: value ?? EMPTY_SELECT,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Choose parallel…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT}>—</SelectItem>
                    {defaultParallelOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground sm:pb-2">
                <input
                  type="checkbox"
                  checked={includeAllRows}
                  onChange={(event) =>
                    setIncludeAllRowsByKey((current) => ({
                      ...current,
                      [cluster.key]: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border"
                />
                Include all rows in this card set ({cluster.totalMatchingRowCount})
              </label>
              <Button
                size="sm"
                disabled={selectedParallel === EMPTY_SELECT}
                onClick={() => {
                  onSessionChange((current) =>
                    bulkUpdateDuplicateClusterParallel(
                      current,
                      cluster,
                      selectedParallel,
                      { includeAllMatchingRows: includeAllRows }
                    )
                  );
                }}
              >
                Apply parallel
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DuplicateIssueGroup({
  issue,
  session,
  onSessionChange,
}: {
  issue: Dm2ImportIssue;
  session: Dm2ImportSession;
  onSessionChange: (updater: (session: Dm2ImportSession) => Dm2ImportSession) => void;
}) {
  const rowsById = new Map(session.rows.map((row) => [row.id, row]));
  const rows = (issue.rowIds ?? [])
    .map((id) => rowsById.get(id))
    .filter((row): row is Dm2ExtractedRow => Boolean(row));
  const resolution = getDuplicateResolution(session, issue);
  const [keepRowId, setKeepRowId] = useState(
    () =>
      resolution?.keepRowId ??
      defaultKeepRowIdForDuplicateGroup(session.rows, issue.rowIds ?? [])
  );
  const [groupParallel, setGroupParallel] = useState(
    () => rows[0]?.parallel || EMPTY_SELECT
  );
  const rowsShareSetParallel =
    rows.length > 0 &&
    rows.every((row) => cardSetParallelKey(row) === cardSetParallelKey(rows[0]));

  function handleResolve(action: "confirmed_duplicate" | "not_duplicate") {
    onSessionChange((current) =>
      resolveDuplicateGroup(
        current,
        issue,
        action,
        action === "confirmed_duplicate" ? keepRowId : undefined
      )
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{issue.type}</Badge>
        <span>{issue.message}</span>
        <span className="text-xs text-muted-foreground">
          {rows.length} matching row(s)
        </span>
        {resolution && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" />
            {resolution.action === "confirmed_duplicate"
              ? "Importing 1 row"
              : "Importing all rows"}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Rows match on card # and set but may differ by parallel. Assign a parallel
        from the dropdown when one is missing or incorrect — the duplicate group
        may clear once rows are distinct.
      </p>
      {rowsShareSetParallel && !resolution && (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/50 p-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px] space-y-1">
            <Label className="text-xs">
              Apply parallel to all {rows.length} rows in this group
            </Label>
            <Select value={groupParallel} onValueChange={(value) => setGroupParallel(value ?? EMPTY_SELECT)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choose parallel…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT}>—</SelectItem>
                {getDm2LookupFieldOptions(session, "parallel", rows[0]).map(
                  (option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={groupParallel === EMPTY_SELECT}
            onClick={() =>
              onSessionChange((current) =>
                bulkUpdateDuplicateIssueParallel(current, issue, groupParallel)
              )
            }
          >
            Apply to group
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[72px]">Keep</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Row</TableHead>
            <TableHead>Card #</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Card set</TableHead>
            <TableHead>Parallel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(row.excluded && "opacity-60")}
            >
              <TableCell>
                <input
                  type="radio"
                  name={`duplicate-keep-${issue.id}`}
                  checked={keepRowId === row.id}
                  disabled={Boolean(resolution)}
                  onChange={() => setKeepRowId(row.id)}
                  className="h-4 w-4"
                  aria-label={`Keep row ${row.sourceRowIndex + 1} for import`}
                />
              </TableCell>
              <TableCell className="text-xs">{row.sourceFileName}</TableCell>
              <TableCell className="text-xs">{row.sourceRowIndex + 1}</TableCell>
              <TableCell className="text-xs">{row.cardNumber ?? "—"}</TableCell>
              <TableCell className="text-xs">{row.player ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatCardSetRowLabel(row)}
              </TableCell>
              <TableCell>
                <ParallelSelectCell
                  row={row}
                  session={session}
                  onSessionChange={onSessionChange}
                  disabled={Boolean(resolution) && row.excluded}
                  highlightMissing
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!resolution ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleResolve("confirmed_duplicate")}
          >
            Same card — skip duplicates
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleResolve("not_duplicate")}
          >
            Different cards — import all
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {resolution.action === "confirmed_duplicate"
            ? "Only the selected row will be imported; other rows in this group are excluded."
            : "All rows in this group will be imported as separate cards."}
        </p>
      )}
    </div>
  );
}

function rowNeedsReview(
  row: Dm2ExtractedRow,
  blockingRowIds: Set<string>,
  duplicateRowIds: Set<string>
): boolean {
  if (blockingRowIds.has(row.id) || duplicateRowIds.has(row.id)) return true;
  const missing = getRowMissingRequiredFields(row);
  return missing.includes("cardNumber") || missing.includes("player");
}

export function Dm2ImportReviewCards({
  session,
  reviewFilter,
  fileFilter,
  cardSetNameFilter,
  cardPage,
  issueFilter,
  onReviewFilterChange,
  onFileFilterChange,
  onCardSetNameFilterChange,
  onCardPageChange,
  onIssueFilterChange,
  onSessionChange,
}: {
  session: Dm2ImportSession;
  reviewFilter: CardReviewFilter;
  fileFilter: string;
  cardSetNameFilter: string;
  cardPage: number;
  issueFilter: "all" | "blocking" | "warning";
  onReviewFilterChange: (filter: CardReviewFilter) => void;
  onFileFilterChange: (file: string) => void;
  onCardSetNameFilterChange: (name: string) => void;
  onCardPageChange: (page: number) => void;
  onIssueFilterChange: (filter: "all" | "blocking" | "warning") => void;
  onSessionChange: (updater: (session: Dm2ImportSession) => Dm2ImportSession) => void;
}) {
  const blockingRowIds = getBlockingRowIds(session);
  const duplicateRowIds = getDuplicateRowIds(session.issues);

  const cardSetNameOptions = (() => {
    const counts = new Map<string, number>();
    for (const row of session.rows) {
      if (row.excluded) continue;
      const name = row.cardSetName?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  })();

  const filteredRows = session.rows.filter((row) => {
    if (fileFilter !== "all" && row.sourceFileName !== fileFilter) return false;
    if (cardSetNameFilter !== "all") {
      const setName = row.cardSetName?.trim() ?? "";
      if (setName !== cardSetNameFilter) return false;
    }

    const missing = getRowMissingRequiredFields(row);
    const missingCardFields =
      missing.includes("cardNumber") || missing.includes("player");

    if (reviewFilter === "blocking" && !blockingRowIds.has(row.id)) return false;
    if (reviewFilter === "duplicates" && !duplicateRowIds.has(row.id)) return false;
    if (reviewFilter === "missing_fields" && !missingCardFields) return false;
    if (
      reviewFilter === "needs_review" &&
      !rowNeedsReview(row, blockingRowIds, duplicateRowIds)
    ) {
      return false;
    }

    return true;
  });

  const needsReviewCount = session.rows.filter(
    (row) => !row.excluded && rowNeedsReview(row, blockingRowIds, duplicateRowIds)
  ).length;

  const cardPageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const cardPageRows = filteredRows.slice(
    cardPage * PAGE_SIZE,
    cardPage * PAGE_SIZE + PAGE_SIZE
  );

  const cardIssues = session.issues.filter(
    (issue) =>
      issue.rowIds != null ||
      issue.type === "MISSING_REQUIRED" ||
      issue.type === "DUPLICATE_EXACT" ||
      issue.type === "DUPLICATE_NEAR" ||
      issue.type === "CROSS_FILE_CONFLICT"
  );
  const filteredCardIssues = cardIssues.filter(
    (issue) => issueFilter === "all" || issue.severity === issueFilter
  );
  const duplicateIssues = filteredCardIssues.filter(isDuplicateIssue);
  const otherCardIssues = filteredCardIssues.filter(
    (issue) => !isDuplicateIssue(issue)
  );

  return (
    <>
      <section className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Confirm card number, player, card set assignment, and parallel for each row.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={reviewFilter === "all" ? "default" : "outline"}
            onClick={() => onReviewFilterChange("all")}
          >
            All cards
            <span className="ml-1.5 text-xs opacity-80">{session.rows.length}</span>
          </Button>
          <Button
            size="sm"
            variant={reviewFilter === "needs_review" ? "default" : "outline"}
            onClick={() => onReviewFilterChange("needs_review")}
          >
            Needs review
            <span
              className={cn(
                "ml-1.5 text-xs",
                needsReviewCount > 0 ? "text-destructive" : "opacity-80"
              )}
            >
              {needsReviewCount}
            </span>
          </Button>
          <Button
            size="sm"
            variant={reviewFilter === "blocking" ? "default" : "outline"}
            onClick={() => onReviewFilterChange("blocking")}
          >
            Blocking
            <span className="ml-1.5 text-xs text-destructive">{blockingRowIds.size}</span>
          </Button>
          <Button
            size="sm"
            variant={reviewFilter === "duplicates" ? "default" : "outline"}
            onClick={() => onReviewFilterChange("duplicates")}
          >
            Duplicates
            <span className="ml-1.5 text-xs">{duplicateRowIds.size}</span>
          </Button>
          <Button
            size="sm"
            variant={reviewFilter === "missing_fields" ? "default" : "outline"}
            onClick={() => onReviewFilterChange("missing_fields")}
          >
            Missing card # / player
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select
            value={fileFilter}
            onValueChange={(value) => {
              onFileFilterChange(value ?? "all");
              onCardPageChange(0);
            }}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Filter by file" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All files</SelectItem>
              {session.files.map((file) => (
                <SelectItem key={file.fileName} value={file.fileName}>
                  {file.fileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={cardSetNameFilter}
            onValueChange={(value) => {
              onCardSetNameFilterChange(value ?? "all");
              onCardPageChange(0);
            }}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Filter by card set name" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All card set names</SelectItem>
              {cardSetNameOptions.map((option) => (
                <SelectItem key={option.name} value={option.name}>
                  {option.name} ({option.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[min(56vh,480px)] overflow-x-auto overflow-y-auto rounded-lg border border-border/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[72px]">Card #</TableHead>
                <TableHead className="min-w-[168px]">Player</TableHead>
                <TableHead className="min-w-[220px]">Card Set</TableHead>
                <TableHead className="min-w-[132px]">Parallel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cardPageRows.map((row) => {
                const missing = getRowMissingRequiredFields(row);
                const rowHasBlocking = blockingRowIds.has(row.id);
                const rowHasDuplicate = duplicateRowIds.has(row.id);

                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      row.excluded && "opacity-50",
                      (rowHasBlocking || rowHasDuplicate) && "bg-destructive/5"
                    )}
                  >
                    <TableCell>
                      <Input
                        defaultValue={row.cardNumber ?? ""}
                        key={`${row.id}-cardNumber-${row.cardNumber ?? ""}`}
                        className={cn(
                          "h-8 min-w-[72px] text-xs",
                          missing.includes("cardNumber") &&
                            "border-destructive text-destructive"
                        )}
                        onBlur={(event) => {
                          if (event.target.value === (row.cardNumber ?? "")) return;
                          onSessionChange((current) =>
                            updateDm2RowFields(current, row.id, {
                              cardNumber: event.target.value,
                            })
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={row.player ?? ""}
                        key={`${row.id}-player-${row.player ?? ""}`}
                        className={cn(
                          "h-8 min-w-[168px] text-xs",
                          missing.includes("player") && "border-destructive text-destructive"
                        )}
                        onBlur={(event) => {
                          if (event.target.value === (row.player ?? "")) return;
                          onSessionChange((current) =>
                            updateDm2RowFields(current, row.id, {
                              player: event.target.value,
                            })
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatCardSetRowLabel(row)}
                    </TableCell>
                    <TableCell>
                      <ParallelSelectCell
                        row={row}
                        session={session}
                        onSessionChange={onSessionChange}
                        highlightMissing={rowHasDuplicate}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {filteredRows.length === 0
              ? "No rows match this filter."
              : filteredRows.length <= PAGE_SIZE
                ? `Showing all ${filteredRows.length} rows.`
                : `Showing rows ${cardPage * PAGE_SIZE + 1}–${Math.min(
                    (cardPage + 1) * PAGE_SIZE,
                    filteredRows.length
                  )} of ${filteredRows.length}.`}
          </p>
          {filteredRows.length > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={cardPage === 0}
                onClick={() => onCardPageChange(Math.max(0, cardPage - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {cardPage + 1} of {cardPageCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={cardPage >= cardPageCount - 1}
                onClick={() =>
                  onCardPageChange(Math.min(cardPageCount - 1, cardPage + 1))
                }
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Card issues ({cardIssues.length})</h3>
          <Select
            value={issueFilter}
            onValueChange={(value) =>
              onIssueFilterChange((value ?? "all") as "all" | "blocking" | "warning")
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All issues</SelectItem>
              <SelectItem value="blocking">Blocking</SelectItem>
              <SelectItem value="warning">Warnings</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {filteredCardIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues in this filter.</p>
          ) : (
            <>
              {duplicateIssues.length > 0 && (
                <div className="space-y-3">
                  <DuplicateBulkParallelPanel
                    session={session}
                    onSessionChange={onSessionChange}
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    Possible duplicates ({duplicateIssues.length} group
                    {duplicateIssues.length === 1 ? "" : "s"})
                  </p>
                  {duplicateIssues.map((issue) => (
                    <DuplicateIssueGroup
                      key={issue.id}
                      issue={issue}
                      session={session}
                      onSessionChange={onSessionChange}
                    />
                  ))}
                </div>
              )}
              {otherCardIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-sm",
                    issue.severity === "blocking"
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border/80 bg-muted/20"
                  )}
                >
                  {issue.severity === "blocking" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={issueBadgeVariant(issue.severity)}>
                        {issue.type}
                      </Badge>
                      <span
                        className={cn(
                          issue.severity === "blocking" && "text-destructive"
                        )}
                      >
                        {issue.message}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}
