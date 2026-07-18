"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  commitDm2ImportSession,
  processDm2ImportFiles,
} from "@/app/actions/dm2-import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  DM2_IMPORT_MAX_FILE_BYTES,
  DM2_IMPORT_MAX_FILES,
  DM2_IMPORT_MAX_TOTAL_BYTES,
} from "@/lib/dm2-import-file-content";
import { Dm2ImportReviewCardSets } from "@/components/dm2-import-review-card-sets";
import { Dm2ImportCommitResultsDialog } from "@/components/dm2-import-commit-results-dialog";
import {
  Dm2ImportReviewCards,
  type CardReviewFilter,
} from "@/components/dm2-import-review-cards";
import {
  buildCardSetGroups,
  commitCardSetsReviewStep,
  countPendingCardSetGroups,
  type CardSetGroupField,
  type CardSetReviewAction,
} from "@/lib/dm2-import-card-sets";
import {
  clearDm2ParallelProposal,
  commitCardsReviewStep,
  commitLookupsReviewStep,
  computeDm2FieldStats,
  DM2_EXISTING_VALUE_MATCH_THRESHOLD,
  getBlockingIssueCount,
  getDuplicateIssueCount,
  getLookupBlockingIssueCount,
  getLookupWarningIssueCount,
  getMergeTargetProposals,
  getPendingProposalCount,
  getReadyRowCount,
  invalidateReviewProgressFrom,
  mergeDm2ProposalReferences,
  updateDm2ProposalAction,
  updateDm2ProposalProposedName,
  updateDm2SessionContextField,
  type Dm2ReviewProgressStep,
} from "@/lib/dm2-import-resolve";
import { cn } from "@/lib/utils";
import type {
  Dm2ImportCommitResult,
  Dm2ImportEntityType,
  Dm2ImportSession,
  Dm2ImportSessionContext,
  Dm2LookupProposal,
} from "@/types/dm2-import";

const ACCEPTED_TYPES = ".pdf,.xlsx,.xls,.csv";
type ReviewStep = "lookups" | "cardSets" | "cards";
type LookupTypeFilter = "all" | "pending" | Dm2ImportEntityType;
type CardSetFieldFilter = "all" | "pending" | CardSetGroupField;

const LOOKUP_ENTITY_TYPES: Dm2ImportEntityType[] = [
  "sport",
  "manufacturer",
  "brand",
  "cardSetCategory",
  "cardSetName",
  "parallel",
];

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function validateSelectedFiles(files: File[]): string | null {
  if (files.length > DM2_IMPORT_MAX_FILES) {
    return `You can upload up to ${DM2_IMPORT_MAX_FILES} files per session.`;
  }

  let totalBytes = 0;
  for (const file of files) {
    if (file.size > DM2_IMPORT_MAX_FILE_BYTES) {
      return `${file.name} exceeds the ${formatMegabytes(DM2_IMPORT_MAX_FILE_BYTES)} per-file limit.`;
    }
    totalBytes += file.size;
  }

  if (totalBytes > DM2_IMPORT_MAX_TOTAL_BYTES) {
    return `Total upload size (${formatMegabytes(totalBytes)}) exceeds the ${formatMegabytes(DM2_IMPORT_MAX_TOTAL_BYTES)} session limit.`;
  }

  return null;
}

function formatProcessError(error: unknown): string {
  if (error instanceof Error) {
    if (/failed to fetch/i.test(error.message)) {
      return "Commit failed — the request timed out or the connection was lost. Large imports can take several minutes; try again after the batch insert update, or check how many cards were saved in the database.";
    }
    return error.message;
  }
  return "Failed to process uploaded files.";
}

function entityTypeLabel(entityType: Dm2LookupProposal["entityType"]): string {
  switch (entityType) {
    case "sport":
      return "Sport (legacy)";
    case "manufacturer":
      return "Manufacturer";
    case "brand":
      return "Brand";
    case "cardSetCategory":
      return "Card Set Category";
    case "cardSetName":
      return "Card Set Name";
    case "parallel":
      return "Parallel";
    default:
      return entityType;
  }
}

function isProposalConfirmed(proposal: Dm2LookupProposal): boolean {
  return proposal.action === "create_new" || proposal.action === "use_existing";
}

function issueBadgeVariant(
  severity: "blocking" | "warning"
): "destructive" | "secondary" {
  return severity === "blocking" ? "destructive" : "secondary";
}

const SESSION_CONTEXT_FIELDS: Array<{
  label: string;
  field: keyof Dm2ImportSessionContext;
  placeholder: string;
  type?: "number" | "text";
}> = [
  { label: "Sport", field: "sport", placeholder: "e.g. Baseball" },
  { label: "Year", field: "year", placeholder: "e.g. 2024", type: "number" },
  { label: "Manufacturer", field: "manufacturer", placeholder: "e.g. Topps" },
  { label: "Brand", field: "brand", placeholder: "e.g. Topps Chrome" },
  {
    label: "Category",
    field: "cardSetCategory",
    placeholder: "e.g. Hobby",
  },
  { label: "Set name", field: "cardSetName", placeholder: "e.g. Chrome" },
];

function applyBulkHighConfidence(session: Dm2ImportSession): Dm2ImportSession {
  let next = session;
  for (const proposal of session.proposals) {
    if (
      proposal.matchId &&
      proposal.confidence >= DM2_EXISTING_VALUE_MATCH_THRESHOLD
    ) {
      next = updateDm2ProposalAction(
        next,
        proposal.id,
        "use_existing",
        proposal.matchId,
        proposal.matchName
      );
    }
  }
  return next;
}

export function Dm2AiLoaderDialog() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [stepCommitting, setStepCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [session, setSession] = useState<Dm2ImportSession | null>(null);
  const [reviewStep, setReviewStep] = useState<ReviewStep>("lookups");
  const [commitResult, setCommitResult] = useState<Dm2ImportCommitResult | null>(
    null
  );
  const [commitResultsOpen, setCommitResultsOpen] = useState(false);
  const [fileFilter, setFileFilter] = useState<string>("all");
  const [cardSetNameFilter, setCardSetNameFilter] = useState<string>("all");
  const [cardReviewFilter, setCardReviewFilter] = useState<CardReviewFilter>("needs_review");
  const [cardSetFieldFilter, setCardSetFieldFilter] = useState<CardSetFieldFilter>("pending");
  const [cardSetActions, setCardSetActions] = useState<Record<string, CardSetReviewAction>>({});
  const [lookupTypeFilter, setLookupTypeFilter] = useState<LookupTypeFilter>("all");
  const [cardPage, setCardPage] = useState(0);
  const [issueFilter, setIssueFilter] = useState<"all" | "blocking" | "warning">(
    "all"
  );

  const blockingCount = session ? getBlockingIssueCount(session) : 0;
  const duplicateIssueCount = session ? getDuplicateIssueCount(session) : 0;
  const lookupBlockingCount = session ? getLookupBlockingIssueCount(session) : 0;
  const lookupWarningCount = session ? getLookupWarningIssueCount(session) : 0;
  const readyRows = session ? getReadyRowCount(session) : 0;
  const cardSetGroups = useMemo(
    () => (session ? buildCardSetGroups(session.rows) : []),
    [session]
  );
  const pendingCardSets = countPendingCardSetGroups(cardSetGroups, cardSetActions);
  const fieldStats = useMemo(
    () => (session ? computeDm2FieldStats(session.rows) : null),
    [session]
  );

  const pendingProposals = session ? getPendingProposalCount(session) : 0;
  const lookupsCommitted = Boolean(session?.reviewProgress?.lookupsCommittedAt);
  const cardSetsCommitted = Boolean(session?.reviewProgress?.cardSetsCommittedAt);
  const cardsReviewCommitted = Boolean(session?.reviewProgress?.cardsReviewCommittedAt);

  function updateSession(
    updater: Dm2ImportSession | ((current: Dm2ImportSession) => Dm2ImportSession),
    invalidateFrom?: Dm2ReviewProgressStep
  ) {
    setSession((current) => {
      if (!current) return current;
      const next = typeof updater === "function" ? updater(current) : updater;
      if (next === current) return current;
      return invalidateFrom
        ? invalidateReviewProgressFrom(next, invalidateFrom)
        : next;
    });
  }

  function handleCardSetActionsChange(actions: Record<string, CardSetReviewAction>) {
    setCardSetActions(actions);
    setSession((current) =>
      current ? invalidateReviewProgressFrom(current, "cardSets") : current
    );
  }

  const lookupTypeStats = useMemo(() => {
    if (!session) return [];
    return LOOKUP_ENTITY_TYPES.map((entityType) => {
      const proposals = session.proposals.filter(
        (proposal) => proposal.entityType === entityType
      );
      const pending = proposals.filter((proposal) => !isProposalConfirmed(proposal))
        .length;
      return {
        entityType,
        total: proposals.length,
        pending,
        confirmed: proposals.length - pending,
      };
    }).filter((stat) => stat.total > 0);
  }, [session]);

  const filteredProposals = useMemo(() => {
    if (!session) return [];
    if (lookupTypeFilter === "all") return session.proposals;
    if (lookupTypeFilter === "pending") {
      return session.proposals.filter(
        (proposal) => !isProposalConfirmed(proposal)
      );
    }
    return session.proposals.filter(
      (proposal) => proposal.entityType === lookupTypeFilter
    );
  }, [session, lookupTypeFilter]);

  const lookupBlockingIssues = useMemo(() => {
    if (!session) return [];
    return session.issues.filter(
      (issue) =>
        issue.severity === "blocking" &&
        (issue.type === "UNRESOLVED_LOOKUP" || issue.type === "AMBIGUOUS_MATCH")
    );
  }, [session]);

  const lookupWarningIssues = useMemo(() => {
    if (!session) return [];
    return session.issues.filter(
      (issue) =>
        issue.severity === "warning" &&
        issue.proposalId != null &&
        issue.type === "LOW_CONFIDENCE"
    );
  }, [session]);

  function resetUploadState() {
    setError(null);
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetSessionState() {
    setSession(null);
    setReviewStep("lookups");
    setReviewOpen(false);
    setCommitOpen(false);
    setFileFilter("all");
    setCardSetNameFilter("all");
    setCardReviewFilter("needs_review");
    setCardSetFieldFilter("pending");
    setCardSetActions({});
    setLookupTypeFilter("all");
    setCardPage(0);
    setIssueFilter("all");
  }

  function resetAll() {
    resetUploadState();
    resetSessionState();
  }

  function runReviewStepCommit(
    work: () => { error?: string; session?: Dm2ImportSession },
    onSuccess?: () => void
  ) {
    const activeSession = session;
    if (!activeSession) return;

    setStepCommitting(true);
    setError(null);

    window.setTimeout(() => {
      try {
        const result = work();
        if (result.error) {
          setError(result.error);
        } else if (result.session) {
          setSession(result.session);
          onSuccess?.();
        }
      } catch (commitError) {
        setError(
          commitError instanceof Error
            ? commitError.message
            : "Step commit failed unexpectedly."
        );
      } finally {
        setStepCommitting(false);
      }
    }, 0);
  }

  function handleCommitLookupsAndContinue() {
    const activeSession = session;
    if (!activeSession) return;
    runReviewStepCommit(
      () => commitLookupsReviewStep(activeSession),
      () => {
        setReviewStep("cardSets");
        setCardSetActions({});
        setCardSetFieldFilter("pending");
      }
    );
  }

  function handleCommitCardSetsAndContinue() {
    const activeSession = session;
    if (!activeSession) return;
    const groups = cardSetGroups;
    const actions = cardSetActions;
    runReviewStepCommit(
      () => commitCardSetsReviewStep(activeSession, groups, actions),
      () => {
        setReviewStep("cards");
        setFileFilter("all");
        setCardSetNameFilter("all");
        setCardReviewFilter("needs_review");
        setCardPage(0);
        setIssueFilter("all");
      }
    );
  }

  function handleCommitCardsAndReview() {
    const activeSession = session;
    if (!activeSession) return;
    runReviewStepCommit(
      () => commitCardsReviewStep(activeSession),
      () => setCommitOpen(true)
    );
  }

  function handleBackToLookups() {
    setReviewStep("lookups");
    setIssueFilter("all");
  }

  function handleBackToCardSets() {
    setReviewStep("cardSets");
    setIssueFilter("all");
  }

  async function handleProcessFiles() {
    if (selectedFiles.length === 0) return;

    const validationError = validateSelectedFiles(selectedFiles);
    if (validationError) {
      setError(validationError);
      return;
    }

    setProcessing(true);
    setError(null);
    setCommitResult(null);

    try {
      const payload = await Promise.all(
        selectedFiles.map(async (file) => {
          const buffer = await file.arrayBuffer();
          return {
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            contentBase64: arrayBufferToBase64(buffer),
          };
        })
      );

      const result = await processDm2ImportFiles(payload);
      if (result.error && (!result.session || result.session.rows.length === 0)) {
        setError(result.error);
        if (result.session) {
          setSession(result.session);
        }
        return;
      }

      if (result.session) {
        const prepared = applyBulkHighConfidence(result.session);
        setSession(prepared);
        setReviewStep("lookups");
        setLookupTypeFilter("all");
        setUploadOpen(false);
        setReviewOpen(true);
        if (result.error) {
          setError(result.error);
        }
      }
    } catch (processError) {
      setError(formatProcessError(processError));
    } finally {
      setProcessing(false);
    }
  }

  function handleReturnToReviewFromCommit() {
    if (!session) return;
    setSession((current) =>
      current ? invalidateReviewProgressFrom(current, "cards") : current
    );
    setReviewStep("cards");
    setReviewOpen(true);
    setCommitResultsOpen(false);
    setError(null);
  }

  function handleDismissCommitResults() {
    setCommitResultsOpen(false);
    if (!commitResult?.canReturnToReview) {
      setCommitResult(null);
    }
  }

  async function handleCommit() {
    if (!session) return;

    setCommitting(true);
    setError(null);

    try {
      const result = await commitDm2ImportSession(session);
      setCommitResult(result);
      setCommitResultsOpen(true);
      router.refresh();
      setCommitOpen(false);

      const partialSuccess =
        (result.cardsCreated ?? 0) > 0 ||
        (result.added?.cards ?? 0) > 0 ||
        (result.cardSetsCreated ?? 0) > 0;

      if (result.canReturnToReview) {
        setSession((current) =>
          current ? invalidateReviewProgressFrom(current, "cards") : current
        );
        setReviewStep("cards");
        setReviewOpen(true);
        return;
      }

      if (result.error && !partialSuccess) {
        setError(result.error);
        setReviewOpen(true);
        return;
      }

      setReviewOpen(false);
      setUploadOpen(false);
      resetSessionState();
    } catch (commitError) {
      setError(formatProcessError(commitError));
    } finally {
      setCommitting(false);
    }
  }

  return (
    <>
      {commitResult && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Import finished
              {commitResult.error
                ? " with errors"
                : commitResult.warning
                  ? " with warnings"
                  : " successfully"}
              .
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommitResultsOpen(true)}
          >
            View import stats
          </Button>
        </div>
      )}
      {error && !reviewOpen && !commitOpen && !uploadOpen && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!processing) {
            setUploadOpen(open);
            if (!open) resetUploadState();
          }
        }}
      >
        <DialogTrigger
          render={
            <Button variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Loader
            </Button>
          }
        />
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Loader</DialogTitle>
            <DialogDescription>
              Upload PDF or spreadsheet checklists. AI extracts and maps data to
              Data Model v2 for consolidated review.
            </DialogDescription>
          </DialogHeader>

          <section className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Accepted types: PDF, XLSX, XLS, CSV</li>
              <li>Upload up to 10 files per session (10 MB per file, 20 MB total)</li>
              <li>Multiple files merge into one review before commit</li>
              <li>Uses existing catalog data and public web research to improve mappings</li>
              <li>Requires OPENAI_API_KEY on the server</li>
            </ul>
          </section>

          <section className="space-y-3">
            <Label htmlFor="dm2-ai-loader-files">Select files</Label>
            <Input
              id="dm2-ai-loader-files"
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              disabled={processing}
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                setSelectedFiles(files);
                setError(null);
              }}
            />
            {selectedFiles.length > 0 && (
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
                {selectedFiles.map((file) => (
                  <p key={file.name}>{file.name}</p>
                ))}
              </div>
            )}
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={processing}
              onClick={() => setUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="gap-2"
              disabled={processing || selectedFiles.length === 0}
              onClick={handleProcessFiles}
            >
                  {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Researching & extracting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Process files
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reviewOpen}
        onOpenChange={(open) => {
          if (!committing) {
            setReviewOpen(open);
            if (!open && !commitOpen) {
              setSession(null);
              setError(null);
            }
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-[min(96vw,1440px)]">
          <DialogHeader>
            <DialogTitle>Review import session</DialogTitle>
            <DialogDescription>
              {reviewStep === "lookups"
                ? "Step 1 of 3 — validate lookup values. Resolve every proposal before reviewing card sets."
                : reviewStep === "cardSets"
                  ? "Step 2 of 3 — validate card set mappings. Confirm each card set combination is complete."
                  : "Step 3 of 3 — validate cards. Confirm card number, player, card set, and parallel."}
            </DialogDescription>
          </DialogHeader>

          {session && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
                {[
                  {
                    step: 1,
                    key: "lookups" as const,
                    title: "Validate lookups",
                    detail: `${session.proposals.length} proposals · ${pendingProposals} pending`,
                  },
                  {
                    step: 2,
                    key: "cardSets" as const,
                    title: "Validate card set",
                    detail: `${cardSetGroups.length} sets · ${pendingCardSets} pending`,
                  },
                  {
                    step: 3,
                    key: "cards" as const,
                    title: "Validate cards",
                    detail: `${session.rows.length} rows · ${readyRows} ready`,
                  },
                ].map((item, index) => {
                  const committed =
                    item.key === "lookups"
                      ? lookupsCommitted
                      : item.key === "cardSets"
                        ? cardSetsCommitted
                        : cardsReviewCommitted;

                  return (
                  <div key={item.key} className="flex items-center gap-2">
                    {index > 0 && (
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        reviewStep === item.key
                          ? "bg-primary text-primary-foreground"
                          : committed
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {committed ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        item.step
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{item.title}</p>
                        {committed && (
                          <Badge variant="secondary" className="text-[10px]">
                            Committed
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Files</p>
                  <p className="text-lg font-semibold">{session.files.length}</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Rows</p>
                  <p className="text-lg font-semibold">{session.rows.length}</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">
                    {reviewStep === "lookups"
                      ? "Lookup issues"
                      : reviewStep === "cardSets"
                        ? "Pending card sets"
                        : "Ready rows"}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      ((reviewStep === "lookups" && lookupBlockingCount > 0) ||
                        (reviewStep === "cardSets" && pendingCardSets > 0)) &&
                        "text-destructive"
                    )}
                  >
                    {reviewStep === "lookups"
                      ? lookupBlockingCount
                      : reviewStep === "cardSets"
                        ? pendingCardSets
                        : readyRows}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Blocking issues</p>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      blockingCount > 0 && "text-destructive"
                    )}
                  >
                    {blockingCount}
                  </p>
                </div>
              </div>

              {reviewStep === "lookups" && (
                <>
                  <section className="rounded-xl border border-border/80 bg-muted/20 p-4">
                    <h3 className="text-sm font-medium">Default metadata</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Applied only when a row is missing that field. Rows can have
                      their own brands, parallels, set names, and other values.
                    </p>
                    {fieldStats && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Distinct values in file — brands: {fieldStats.brand},
                        parallels: {fieldStats.parallel}, set names:{" "}
                        {fieldStats.cardSetName}, manufacturers:{" "}
                        {fieldStats.manufacturer}
                      </p>
                    )}
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {SESSION_CONTEXT_FIELDS.map(({ label, field, placeholder, type }) => (
                        <div key={field} className="space-y-1">
                          <Label htmlFor={`session-${field}`} className="text-xs">
                            {label}
                          </Label>
                          <Input
                            id={`session-${field}`}
                            type={type ?? "text"}
                            placeholder={placeholder}
                            defaultValue={
                              field === "year"
                                ? session.sessionContext.year?.toString() ?? ""
                                : (session.sessionContext[field] as string | undefined) ?? ""
                            }
                            key={`${field}-${session.sessionContext[field] ?? ""}`}
                            onBlur={(event) =>
                              updateSession(
                                (current) =>
                                  updateDm2SessionContextField(
                                    current,
                                    field,
                                    event.target.value
                                  ),
                                "lookups"
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateSession(
                            (current) => applyBulkHighConfidence(current),
                            "lookups"
                          )
                        }
                      >
                        Accept high-confidence matches
                      </Button>
                      <p className="self-center text-xs text-muted-foreground">
                        {pendingProposals} proposals still need a decision. Edit
                        the proposed name before choosing Create new.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={lookupTypeFilter === "all" ? "default" : "outline"}
                        onClick={() => setLookupTypeFilter("all")}
                      >
                        All
                        <span className="ml-1.5 text-xs opacity-80">
                          {pendingProposals} pending / {session.proposals.length}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        variant={lookupTypeFilter === "pending" ? "default" : "outline"}
                        onClick={() => setLookupTypeFilter("pending")}
                      >
                        Pending
                        <span
                          className={cn(
                            "ml-1.5 text-xs",
                            pendingProposals > 0
                              ? lookupTypeFilter === "pending"
                                ? "opacity-90"
                                : "text-destructive"
                              : "opacity-80"
                          )}
                        >
                          {pendingProposals}
                        </span>
                      </Button>
                      {lookupTypeStats.map((stat) => (
                        <Button
                          key={stat.entityType}
                          size="sm"
                          variant={
                            lookupTypeFilter === stat.entityType ? "default" : "outline"
                          }
                          onClick={() => setLookupTypeFilter(stat.entityType)}
                        >
                          {entityTypeLabel(stat.entityType)}
                          <span
                            className={cn(
                              "ml-1.5 text-xs",
                              stat.pending > 0
                                ? lookupTypeFilter === stat.entityType
                                  ? "opacity-90"
                                  : "text-destructive"
                                : "opacity-80"
                            )}
                          >
                            {stat.pending} pending · {stat.confirmed} confirmed
                          </span>
                        </Button>
                      ))}
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Proposed name</TableHead>
                          <TableHead>Match</TableHead>
                          <TableHead>Refs</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead className="w-[140px]">Merge</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProposals.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center text-sm text-muted-foreground"
                            >
                              No proposals match this filter.
                              {lookupTypeFilter === "pending" && pendingProposals === 0
                                ? " All lookups are confirmed."
                                : null}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredProposals.map((proposal) => {
                          const mergeTargets = session
                            ? getMergeTargetProposals(session, proposal.id)
                            : [];

                          return (
                          <TableRow key={proposal.id}>
                            <TableCell>{entityTypeLabel(proposal.entityType)}</TableCell>
                            <TableCell>
                              <Input
                                defaultValue={proposal.proposedName}
                                key={`${proposal.id}-${proposal.proposedName}-${proposal.action}`}
                                className="min-w-[140px]"
                                aria-label={`Correct proposed ${entityTypeLabel(proposal.entityType).toLowerCase()} name`}
                                onBlur={(event) => {
                                  const value = event.target.value;
                                  updateSession(
                                    (current) =>
                                      updateDm2ProposalProposedName(
                                        current,
                                        proposal.id,
                                        value
                                      ),
                                    "lookups"
                                  );
                                }}
                              />
                              {proposal.action === "create_new" && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Will create &ldquo;{proposal.proposedName}&rdquo;
                                </p>
                              )}
                              {proposal.manufacturerName && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Mfr: {proposal.manufacturerName}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              {proposal.matchName ? (
                                <span>
                                  {proposal.matchName}
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({Math.round(proposal.confidence * 100)}%)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>{proposal.referenceCount}</TableCell>
                            <TableCell>
                              <Select
                                value={
                                  proposal.action === "use_existing" && proposal.matchId
                                    ? `existing:${proposal.matchId}`
                                    : proposal.action
                                }
                                onValueChange={(value) => {
                                  if (!session || !value) return;
                                  if (value === "clear_parallel") {
                                    const confirmed = window.confirm(
                                      `Remove parallel "${proposal.proposedName}" from ${proposal.referenceCount} card${
                                        proposal.referenceCount === 1 ? "" : "s"
                                      }?\n\nThese cards will have no parallel value. The proposal will be removed.`
                                    );
                                    if (!confirmed) return;
                                    updateSession(
                                      clearDm2ParallelProposal(session, proposal.id),
                                      "lookups"
                                    );
                                    return;
                                  }
                                  if (value === "create_new") {
                                    updateSession(
                                      updateDm2ProposalAction(
                                        session,
                                        proposal.id,
                                        "create_new"
                                      ),
                                      "lookups"
                                    );
                                    return;
                                  }
                                  if (value === "pending") {
                                    updateSession(
                                      updateDm2ProposalAction(
                                        session,
                                        proposal.id,
                                        "pending"
                                      ),
                                      "lookups"
                                    );
                                    return;
                                  }
                                  if (value.startsWith("existing:")) {
                                    const matchId = value.replace("existing:", "");
                                    const candidate = proposal.matchCandidates?.find(
                                      (item) => item.id === matchId
                                    );
                                    updateSession(
                                      updateDm2ProposalAction(
                                        session,
                                        proposal.id,
                                        "use_existing",
                                        matchId,
                                        candidate?.name ?? proposal.matchName
                                      ),
                                      "lookups"
                                    );
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Review</SelectItem>
                                  {proposal.entityType === "parallel" && (
                                    <SelectItem value="clear_parallel">
                                      Remove parallel
                                    </SelectItem>
                                  )}
                                  <SelectItem value="create_new">
                                    Create new as proposed
                                  </SelectItem>
                                  {proposal.matchId && (
                                    <SelectItem value={`existing:${proposal.matchId}`}>
                                      Use {proposal.matchName}
                                    </SelectItem>
                                  )}
                                  {proposal.matchCandidates
                                    ?.filter((item) => item.id !== proposal.matchId)
                                    .map((candidate) => (
                                      <SelectItem
                                        key={candidate.id}
                                        value={`existing:${candidate.id}`}
                                      >
                                        Use {candidate.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {mergeTargets.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 gap-1"
                                      />
                                    }
                                  >
                                    <ArrowRightLeft className="size-3.5" />
                                    Move refs
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="max-h-64 w-72">
                                    <DropdownMenuGroup>
                                      <DropdownMenuLabel>
                                        Move {proposal.referenceCount} ref
                                        {proposal.referenceCount === 1 ? "" : "s"} to…
                                      </DropdownMenuLabel>
                                      {mergeTargets.map((target) => (
                                        <DropdownMenuItem
                                          key={target.id}
                                          className="cursor-pointer"
                                          onClick={() => {
                                            const confirmed = window.confirm(
                                              `Move ${proposal.referenceCount} reference${
                                                proposal.referenceCount === 1 ? "" : "s"
                                              } from "${proposal.proposedName}" to "${target.proposedName}"?\n\nThis removes the "${proposal.proposedName}" proposal.`
                                            );
                                            if (!confirmed) return;
                                            updateSession(
                                              mergeDm2ProposalReferences(
                                                session,
                                                proposal.id,
                                                target.id
                                              ),
                                              "lookups"
                                            );
                                          }}
                                        >
                                          <span className="truncate">{target.proposedName}</span>
                                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                            {target.referenceCount} refs
                                          </span>
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuGroup>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          </TableRow>
                          );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </section>

                  {(lookupBlockingIssues.length > 0 || lookupWarningIssues.length > 0) && (
                    <section className="space-y-3">
                      {lookupBlockingIssues.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-destructive">
                            Blocking lookup issues ({lookupBlockingIssues.length})
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Resolve these before continuing — set each proposal&apos;s
                            Action to Create new or Use existing.
                          </p>
                          {lookupBlockingIssues.map((issue) => (
                            <div
                              key={issue.id}
                              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
                            >
                              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="destructive">{issue.type}</Badge>
                                  <span>{issue.message}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {lookupWarningIssues.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">
                            Lookup warnings ({lookupWarningIssues.length})
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            These do not block continuing to cards.
                          </p>
                          {lookupWarningIssues.map((issue) => (
                            <div
                              key={issue.id}
                              className="flex items-start gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm"
                            >
                              <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">{issue.type}</Badge>
                                  <span>{issue.message}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}

              {reviewStep === "cardSets" && session && (
                <Dm2ImportReviewCardSets
                  session={session}
                  actions={cardSetActions}
                  fieldFilter={cardSetFieldFilter}
                  onActionsChange={handleCardSetActionsChange}
                  onFieldFilterChange={setCardSetFieldFilter}
                  onSessionChange={(updater) => updateSession(updater, "cardSets")}
                />
              )}

              {reviewStep === "cards" && session && (
                <Dm2ImportReviewCards
                  session={session}
                  reviewFilter={cardReviewFilter}
                  fileFilter={fileFilter}
                  cardSetNameFilter={cardSetNameFilter}
                  cardPage={cardPage}
                  issueFilter={issueFilter}
                  onReviewFilterChange={setCardReviewFilter}
                  onFileFilterChange={setFileFilter}
                  onCardSetNameFilterChange={setCardSetNameFilter}
                  onCardPageChange={setCardPage}
                  onIssueFilterChange={setIssueFilter}
                  onSessionChange={(updater) => updateSession(updater, "cards")}
                />
              )}

            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {reviewStep === "lookups" && session && !lookupsCommitted && (pendingProposals > 0 || lookupBlockingCount > 0) && (
            <p className="text-xs text-muted-foreground">
              Commit is disabled:
              {pendingProposals > 0 && ` ${pendingProposals} proposal(s) still on Review.`}
              {pendingProposals > 0 && lookupBlockingCount > 0 && " "}
              {lookupBlockingCount > 0 &&
                ` ${lookupBlockingCount} blocking lookup issue(s).`}
              {lookupWarningCount > 0 &&
                ` (${lookupWarningCount} warning(s) do not block.)`}
            </p>
          )}
          {reviewStep === "lookups" && session && lookupsCommitted && (
            <p className="text-xs text-muted-foreground">
              Lookups committed. You can go back to edit, then commit again to
              continue.
            </p>
          )}

          {reviewStep === "cardSets" && session && !cardSetsCommitted && pendingCardSets > 0 && (
            <p className="text-xs text-muted-foreground">
              Commit is disabled: {pendingCardSets} card set(s) still need confirmation
              or have missing required fields.
            </p>
          )}
          {reviewStep === "cardSets" && session && cardSetsCommitted && (
            <p className="text-xs text-muted-foreground">
              Card sets committed. You can go back to edit, then commit again to
              continue.
            </p>
          )}
          {reviewStep === "cards" && session && !cardsReviewCommitted && duplicateIssueCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Commit is disabled: resolve {duplicateIssueCount} duplicate group(s)
              using Same card or Different cards.
            </p>
          )}
          {reviewStep === "cards" && session && !cardsReviewCommitted && blockingCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Commit cards is disabled: {blockingCount} blocking issue(s) remain.
            </p>
          )}
          {reviewStep === "cards" && session && cardsReviewCommitted && (
            <p className="text-xs text-muted-foreground">
              Cards review committed. Use Review import to save to the database.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={committing || stepCommitting}
              onClick={() => {
                setReviewOpen(false);
                setSession(null);
                setReviewStep("lookups");
              }}
            >
              Cancel
            </Button>
            {reviewStep === "lookups" ? (
              <Button
                className="gap-2"
                disabled={
                  !session ||
                  stepCommitting ||
                  pendingProposals > 0 ||
                  lookupBlockingCount > 0
                }
                onClick={handleCommitLookupsAndContinue}
              >
                {stepCommitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Committing...
                  </>
                ) : (
                  <>
                    Commit & continue to card sets
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            ) : reviewStep === "cardSets" ? (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={committing || stepCommitting}
                  onClick={handleBackToLookups}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to lookups
                </Button>
                <Button
                  className="gap-2"
                  disabled={
                    !session ||
                    stepCommitting ||
                    pendingCardSets > 0
                  }
                  onClick={handleCommitCardSetsAndContinue}
                >
                  {stepCommitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Committing...
                    </>
                  ) : (
                    <>
                      Commit & continue to cards
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={committing || stepCommitting}
                  onClick={handleBackToCardSets}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to card sets
                </Button>
                <Button
                  className="gap-2"
                  disabled={
                    !session ||
                    committing ||
                    stepCommitting ||
                    blockingCount > 0 ||
                    duplicateIssueCount > 0 ||
                    readyRows === 0
                  }
                  onClick={handleCommitCardsAndReview}
                >
                  {stepCommitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Committing...
                    </>
                  ) : (
                    <>
                      Commit & review import
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={commitOpen} onOpenChange={setCommitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Commit import</DialogTitle>
            <DialogDescription>
              This will create new lookup values and cards in Data Model v2.
              Duplicates are skipped.
            </DialogDescription>
          </DialogHeader>

          {session && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">{readyRows}</span> cards ready to
                import
              </p>
              <p className="text-muted-foreground">
                {session.proposals.filter((p) => p.action === "create_new").length}{" "}
                new lookups will be created.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={committing}
              onClick={() => setCommitOpen(false)}
            >
              Back
            </Button>
            <Button disabled={committing || !session} onClick={handleCommit}>
              {committing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Committing...
                </>
              ) : (
                "Approve & commit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dm2ImportCommitResultsDialog
        open={commitResultsOpen}
        onOpenChange={setCommitResultsOpen}
        result={commitResult}
        onReturnToReview={handleReturnToReviewFromCommit}
        onDismiss={handleDismissCommitResults}
      />
    </>
  );
}
