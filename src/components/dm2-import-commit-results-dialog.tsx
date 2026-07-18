"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  RotateCcw,
  XCircle,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMMIT_DETAIL_LIMIT } from "@/lib/dm2-import-commit-stats";
import { cn } from "@/lib/utils";
import type { Dm2ImportCommitResult } from "@/types/dm2-import";

interface Dm2ImportCommitResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: Dm2ImportCommitResult | null;
  onReturnToReview?: () => void;
  onDismiss?: () => void;
}

function addedRows(result: Dm2ImportCommitResult) {
  const added = result.added;
  if (!added) return [];

  return [
    { label: "Sports", count: added.sports },
    { label: "Manufacturers", count: added.manufacturers },
    { label: "Brands", count: added.brands },
    { label: "Card set categories", count: added.cardSetCategories },
    { label: "Card set names", count: added.cardSetNames },
    { label: "Parallels", count: added.parallels },
    { label: "Card sets", count: added.cardSets },
    { label: "Cards", count: added.cards },
  ].filter((row) => row.count > 0);
}

function totalAddedCount(result: Dm2ImportCommitResult): number {
  return addedRows(result).reduce((sum, row) => sum + row.count, 0);
}

function totalDuplicateCount(result: Dm2ImportCommitResult): number {
  if ((result.cardsSkipped ?? 0) > (result.duplicates?.filter((d) => d.entityType === "card").length ?? 0)) {
    return result.cardsSkipped ?? result.duplicates?.length ?? 0;
  }
  return result.duplicates?.length ?? result.cardsSkipped ?? 0;
}

function totalErrorCount(result: Dm2ImportCommitResult): number {
  return Math.max(
    result.errors?.length ?? 0,
    result.cardsFailed ?? 0,
    result.error ? 1 : 0
  );
}

function statusTone(result: Dm2ImportCommitResult): "success" | "warning" | "error" {
  if (result.error && (result.cardsCreated ?? 0) === 0 && totalAddedCount(result) === 0) {
    return "error";
  }
  if (result.error || result.warning || (result.errors?.length ?? 0) > 0) {
    return "warning";
  }
  return "success";
}

export function Dm2ImportCommitResultsDialog({
  open,
  onOpenChange,
  result,
  onReturnToReview,
  onDismiss,
}: Dm2ImportCommitResultsDialogProps) {
  if (!result) return null;

  const added = addedRows(result);
  const duplicates = result.duplicates ?? [];
  const errors = result.errors ?? [];
  const duplicateTotal = totalDuplicateCount(result);
  const errorTotal = totalErrorCount(result);
  const tone = statusTone(result);
  const defaultTab =
    errorTotal > 0 ? "errors" : duplicateTotal > 0 ? "duplicates" : "added";

  const title =
    tone === "success"
      ? "Import complete"
      : tone === "warning"
        ? "Import completed with issues"
        : "Import failed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tone === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : tone === "warning" ? (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            {result.error
              ? result.error
              : result.warning
                ? result.warning
                : "All rows were saved successfully."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Added</p>
            <p className="text-2xl font-semibold">{totalAddedCount(result)}</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Duplicates skipped</p>
            <p className="text-2xl font-semibold">{duplicateTotal}</p>
          </div>
          <div
            className={cn(
              "rounded-lg border border-border/80 bg-muted/20 p-3",
              errorTotal > 0 && "border-destructive/40"
            )}
          >
            <p className="text-xs text-muted-foreground">Errors</p>
            <p
              className={cn(
                "text-2xl font-semibold",
                errorTotal > 0 && "text-destructive"
              )}
            >
              {errorTotal}
            </p>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="min-h-0 flex-1">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="added">Added ({added.length})</TabsTrigger>
            <TabsTrigger value="duplicates">
              Duplicates ({duplicateTotal})
            </TabsTrigger>
            <TabsTrigger value="errors">Errors ({errorTotal})</TabsTrigger>
          </TabsList>

          <TabsContent value="added" className="mt-4 min-h-0 overflow-y-auto">
            {added.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No new catalog values were created. Existing entries were reused
                or only duplicate cards were skipped.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {added.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right font-medium">
                        {row.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent
            value="duplicates"
            className="mt-4 min-h-0 overflow-y-auto"
          >
            {duplicates.length === 0 && (result.cardsSkipped ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No duplicates were encountered during this import.
              </p>
            ) : (
              <div className="space-y-3">
                {(result.cardsSkipped ?? 0) > duplicates.filter((d) => d.entityType === "card").length && (
                  <p className="text-sm text-muted-foreground">
                    {result.cardsSkipped} duplicate card(s) skipped
                    {duplicates.length < (result.cardsSkipped ?? 0)
                      ? ` (showing first ${duplicates.filter((d) => d.entityType === "card").length} examples)`
                      : ""}
                    .
                  </p>
                )}
                {duplicates.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Detail</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {duplicates.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{item.entityType}</Badge>
                              <span className="text-sm">{item.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.detail ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.sourceFileName ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {duplicateTotal > COMMIT_DETAIL_LIMIT && (
                  <p className="text-xs text-muted-foreground">
                    Showing first {COMMIT_DETAIL_LIMIT} duplicate entries.
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="errors" className="mt-4 min-h-0 overflow-y-auto">
            {errors.length === 0 && !result.error ? (
              <p className="text-sm text-muted-foreground">
                No errors were recorded for this import.
              </p>
            ) : (
              <div className="space-y-3">
                {result.error && errors.length === 0 && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium text-destructive">{result.error}</p>
                  </div>
                )}
                {errors.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">{item.code}</Badge>
                      {item.sourceFileName && (
                        <span className="text-xs text-muted-foreground">
                          {item.sourceFileName}
                          {item.sourceRowIndex != null
                            ? ` · row ${item.sourceRowIndex + 1}`
                            : ""}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-medium">{item.message}</p>
                    {(item.cardNumber || item.player || item.cardSetName) && (
                      <p className="mt-1 text-muted-foreground">
                        {[item.cardNumber ? `#${item.cardNumber}` : null, item.player, item.cardSetName]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <div className="mt-3 rounded-md border border-border/60 bg-background/80 p-2.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        How to fix
                      </p>
                      <p className="mt-1 text-sm">{item.remedy}</p>
                    </div>
                  </div>
                ))}
                {errorTotal > COMMIT_DETAIL_LIMIT && (
                  <p className="text-xs text-muted-foreground">
                    Showing first {COMMIT_DETAIL_LIMIT} errors. Fix these and
                    commit again; remaining failures will appear on the next
                    attempt.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {result.canReturnToReview && onReturnToReview && (
              <Button variant="outline" className="gap-2" onClick={onReturnToReview}>
                <RotateCcw className="h-4 w-4" />
                Return to review
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                void navigator.clipboard.writeText(
                  JSON.stringify(result, null, 2)
                );
              }}
            >
              <Copy className="h-4 w-4" />
              Copy report
            </Button>
            <Button
              onClick={() => {
                onDismiss?.();
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
