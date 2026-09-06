"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil, Search } from "lucide-react";
import {
  getDm2CardPopulation,
  ingestPsaPopulationJson,
  saveDm2CardSetPsaHeading,
  searchDm2CardsForPopulation,
  upsertDm2CardPopulation,
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
import {
  CARD_POPULATION_ADMIN_TITLE,
  CARD_POPULATION_IDENTITY_FIELDS,
  CARD_POPULATION_GRADERS,
  countsToFormValues,
  emptyPopulationCounts,
  fieldsByGrader,
} from "@/lib/dm2-card-population";
import { DM2_CARD_SEARCH_PAGE_SIZE } from "@/types/data-model-v2";
import type {
  Dm2CardPopulationSearchResult,
  Dm2CardSearchResult,
  Dm2CardSet,
} from "@/types/data-model-v2";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function CardIdentity({ card }: { card: Dm2CardSearchResult }) {
  const values: Record<(typeof CARD_POPULATION_IDENTITY_FIELDS)[number], string> = {
    Player: card.player,
    "Card #": card.cardNumber,
    Sport: card.sportName,
    Year: String(card.year),
    Manufacturer: card.manufacturerName,
    Brand: card.brandName,
    "Card Set": card.cardSetName,
    "Card Set Category": card.cardSetCategoryName,
    Parallel: card.parallelName ?? "—",
    "Unique Card ID": card.id,
  };
  const fields = CARD_POPULATION_IDENTITY_FIELDS.map(
    (label) => [label, values[label]] as const
  );

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className={label === "Unique Card ID" ? "font-mono text-xs" : "text-sm font-medium"}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminDm2CardPopulationSection({
  cardSets,
}: {
  cardSets: Dm2CardSet[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Dm2CardPopulationSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editCard, setEditCard] = useState<Dm2CardSearchResult | null>(null);
  const [form, setForm] = useState<Record<string, string>>(
    countsToFormValues(emptyPopulationCounts())
  );
  const [recordExists, setRecordExists] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [importSetId, setImportSetId] = useState("");
  const [importHeading, setImportHeading] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = debouncedQuery.length >= 2;
  const groupedFields = useMemo(() => fieldsByGrader(), []);
  const pageCount = Math.max(1, Math.ceil(totalCount / DM2_CARD_SEARCH_PAGE_SIZE));
  const sortedCardSets = useMemo(
    () =>
      [...cardSets].sort(
        (a, b) =>
          b.year - a.year ||
          a.brandName.localeCompare(b.brandName) ||
          a.cardSetName.localeCompare(b.cardSetName)
      ),
    [cardSets]
  );
  const selectedImportSet = sortedCardSets.find((set) => set.id === importSetId);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setTotalCount(0);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchDm2CardsForPopulation(debouncedQuery, {
      page,
      pageSize: DM2_CARD_SEARCH_PAGE_SIZE,
    }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      setSearched(true);
      if (result.error) {
        setError(result.error);
        setResults([]);
        setTotalCount(0);
        return;
      }
      setResults(result.cards ?? []);
      setTotalCount(result.totalCount ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, [canSearch, debouncedQuery, page]);

  async function openEditor(card: Dm2CardSearchResult) {
    setEditCard(card);
    setEditorError(null);
    setEditorLoading(true);
    setForm(countsToFormValues(emptyPopulationCounts()));
    setRecordExists(false);

    const result = await getDm2CardPopulation(card.id);
    setEditorLoading(false);
    if (result.error) {
      setEditorError(result.error);
      return;
    }
    if (result.card) setEditCard(result.card);
    setRecordExists(result.population != null);
    setForm(
      countsToFormValues(result.population?.counts ?? emptyPopulationCounts())
    );
  }

  async function savePopulation() {
    if (!editCard) return;
    setPending(true);
    setEditorError(null);
    const result = await upsertDm2CardPopulation({
      cardId: editCard.id,
      form,
    });
    setPending(false);
    if (result.error) {
      setEditorError(result.error);
      return;
    }

    setRecordExists(true);
    setResults((rows) =>
      rows.map((row) =>
        row.id === editCard.id ? { ...row, populationStatus: "Exists" } : row
      )
    );
    setEditCard(null);
  }

  async function saveHeading() {
    if (!importSetId) return;
    setPending(true);
    setImportMessage(null);
    setError(null);
    const result = await saveDm2CardSetPsaHeading({
      cardSetId: importSetId,
      heading: importHeading,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setImportMessage(
      result.psaHeadingId
        ? `Saved PSA heading ${result.psaHeadingId} on this card set.`
        : "Cleared the PSA heading on this card set."
    );
  }

  async function importPsaJson(writeAuto: boolean) {
    if (!importSetId || !importJson.trim()) return;
    setPending(true);
    setImportMessage(null);
    setError(null);
    const result = await ingestPsaPopulationJson({
      cardSetId: importSetId,
      jsonText: importJson,
      writeAuto,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setImportMessage(
      writeAuto
        ? `Wrote ${result.wrote ?? 0} auto-matched PSA rows · review ${result.review ?? 0} · reject ${result.reject ?? 0}.`
        : `Dry run: auto ${result.auto ?? 0} · review ${result.review ?? 0} · reject ${result.reject ?? 0}. Nothing written.`
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-sm font-medium">{CARD_POPULATION_ADMIN_TITLE}</h3>
            <p className="text-xs text-muted-foreground">
              Search catalog cards to create or update graded population counts
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-4 border-t border-border/80 bg-background px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Search by player, year, manufacturer, brand, card set, or
            parallel. Cards appear whether or not a population record exists.
          </p>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {importMessage ? (
            <p className="text-sm text-muted-foreground">{importMessage}</p>
          ) : null}

          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <h4 className="text-sm font-medium">Import captured PSA JSON</h4>
              <p className="text-xs text-muted-foreground">
                Save the heading id from a PSA pop URL, then paste captured set
                JSON. This does not fetch PSA.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="psa-import-set">Card set</Label>
                <select
                  id="psa-import-set"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={importSetId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setImportSetId(nextId);
                    const next = sortedCardSets.find((set) => set.id === nextId);
                    if (next?.psaHeadingId != null) {
                      setImportHeading(String(next.psaHeadingId));
                    }
                  }}
                >
                  <option value="">Select a card set</option>
                  {sortedCardSets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.year} {set.brandName} {set.cardSetName}
                      {set.psaHeadingId ? ` · PSA ${set.psaHeadingId}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="psa-heading">PSA heading id or pop URL</Label>
                <Input
                  id="psa-heading"
                  value={importHeading}
                  onChange={(event) => setImportHeading(event.target.value)}
                  placeholder="https://www.psacard.com/pop/.../154126"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="psa-json">Captured JSON</Label>
              <textarea
                id="psa-json"
                value={importJson}
                onChange={(event) => setImportJson(event.target.value)}
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                placeholder='{"items":[{"CardNumber":"1","Subject":"Markelle Fultz","Grade10":17}]}'
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending || !importSetId}
                onClick={() => void saveHeading()}
              >
                Save heading
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || !importSetId || !importJson.trim()}
                onClick={() => void importPsaJson(false)}
              >
                Dry run
              </Button>
              <Button
                type="button"
                disabled={pending || !importSetId || !importJson.trim()}
                onClick={() => void importPsaJson(true)}
              >
                Write auto matches
              </Button>
            </div>
            {selectedImportSet?.psaHeadingId ? (
              <p className="text-xs text-muted-foreground">
                Linked heading {selectedImportSet.psaHeadingId}. Refresh later
                by capturing that set JSON again.
              </p>
            ) : null}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search player, year, set, brand, or parallel…"
              className="pl-9"
              aria-label="Search cards for population"
            />
          </div>

          {!canSearch ? (
            <p className="text-sm text-muted-foreground">
              Enter at least two characters to search the Cards table.
            </p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : searched && results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No matching cards. Try another player, year, set, brand, or parallel.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Card #</TableHead>
                    <TableHead>Sport</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Card Set</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Parallel</TableHead>
                    <TableHead>Unique Card ID</TableHead>
                    <TableHead>Population Record Status</TableHead>
                    <TableHead className="w-[1%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">{card.player}</TableCell>
                      <TableCell>{card.cardNumber}</TableCell>
                      <TableCell>{card.sportName}</TableCell>
                      <TableCell>{card.year}</TableCell>
                      <TableCell>{card.manufacturerName}</TableCell>
                      <TableCell>{card.brandName}</TableCell>
                      <TableCell>{card.cardSetName}</TableCell>
                      <TableCell>{card.cardSetCategoryName}</TableCell>
                      <TableCell>{card.parallelName ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {card.id}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            card.populationStatus === "Exists" ? "secondary" : "outline"
                          }
                        >
                          {card.populationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditor(card)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          {card.populationStatus === "Exists" ? "Edit" : "Create"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {canSearch && totalCount > DM2_CARD_SEARCH_PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                Showing {(page - 1) * DM2_CARD_SEARCH_PAGE_SIZE + 1}–
                {Math.min(page * DM2_CARD_SEARCH_PAGE_SIZE, totalCount)} of{" "}
                {totalCount.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <Dialog
        open={editCard != null}
        onOpenChange={(open) => {
          if (!open) setEditCard(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {recordExists ? "Edit card population" : "Create card population"}
            </DialogTitle>
            <DialogDescription>
              Card identity is read-only. Leave a grade blank to keep it
              unknown. Zero means the grader reported no copies.
            </DialogDescription>
          </DialogHeader>

          {editCard ? (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
              <CardIdentity card={editCard} />

              {editorLoading ? (
                <p className="text-sm text-muted-foreground">Loading population…</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {CARD_POPULATION_GRADERS.map((grader) => (
                    <div key={grader} className="rounded-lg border">
                      <h4 className="border-b px-3 py-2 text-sm font-medium">{grader}</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Grade</TableHead>
                            <TableHead className="text-right">Population</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedFields[grader].map((field) => (
                            <TableRow key={field.key}>
                              <TableCell>{field.grade}</TableCell>
                              <TableCell className="text-right">
                                <Label htmlFor={field.key} className="sr-only">
                                  {grader} {field.grade} population
                                </Label>
                                <Input
                                  id={field.key}
                                  inputMode="numeric"
                                  value={form[field.key] ?? ""}
                                  placeholder="—"
                                  className="ml-auto max-w-32 text-right"
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      [field.key]: event.target.value,
                                    }))
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}

              {editorError ? (
                <p className="text-sm text-destructive">{editorError}</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCard(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending || editorLoading || !editCard}
              onClick={() => void savePopulation()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
