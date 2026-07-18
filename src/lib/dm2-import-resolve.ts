import { createId } from "@/lib/create-id";
import { applyCatalogCardSetHintsToRows } from "@/lib/dm2-import-catalog-hints";
import { reconcileExtractedRowsWithCatalogParallels } from "@/lib/dm2-import-parallel-reconcile";
import type {
  Dm2ExtractedRow,
  Dm2FieldSuggestion,
  Dm2ImportCatalogContext,
  Dm2ImportFieldStats,
  Dm2ImportIssue,
  Dm2ImportResearchNote,
  Dm2ImportSession,
  Dm2ImportSessionContext,
  Dm2LookupProposal,
  Dm2LookupProposalAction,
  Dm2MappingFrameworkNote,
  Dm2DuplicateResolution,
  Dm2DuplicateResolutionAction,
} from "@/types/dm2-import";

/** Minimum fuzzy-match score required to auto-map a lookup to an existing catalog value. */
export const DM2_EXISTING_VALUE_MATCH_THRESHOLD = 0.95;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function mergeContext(
  contexts: Dm2ImportSessionContext[]
): Dm2ImportSessionContext {
  const merged: Dm2ImportSessionContext = {};
  const fields: Array<keyof Dm2ImportSessionContext> = [
    "sport",
    "year",
    "manufacturer",
    "brand",
    "cardSetCategory",
    "cardSetName",
  ];

  for (const field of fields) {
    const values = new Set<string | number>();
    for (const context of contexts) {
      const value = context[field];
      if (value != null && value !== "") {
        values.add(value);
      }
    }
    if (values.size === 1) {
      merged[field] = [...values][0] as never;
    }
  }

  return merged;
}

export function applySessionContextToRows(
  rows: Dm2ExtractedRow[],
  context: Dm2ImportSessionContext
): Dm2ExtractedRow[] {
  return rows.map((row) => {
    const sharesSetName =
      !row.cardSetName?.trim() ||
      !context.cardSetName?.trim() ||
      normalizeKey(row.cardSetName) === normalizeKey(context.cardSetName);

    return {
      ...row,
      sport: row.sport ?? context.sport,
      year: row.year ?? context.year,
      manufacturer: row.manufacturer ?? context.manufacturer,
      brand: row.brand ?? context.brand,
      cardSetCategory:
        row.cardSetCategory ??
        (sharesSetName ? context.cardSetCategory : undefined),
      cardSetName: row.cardSetName ?? context.cardSetName,
    };
  });
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function fuzzyScore(a: string, b: string): number {
  const left = normalizeKey(a);
  const right = normalizeKey(b);
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const distance = levenshtein(left, right);
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 0;
  return Math.max(0, 1 - distance / maxLen);
}

function findBestMatch(
  proposedName: string,
  candidates: Array<{ id: string; name: string; active: boolean }>
): {
  matchId?: string;
  matchName?: string;
  confidence: number;
  matchCandidates: Array<{ id: string; name: string; score: number }>;
} {
  const scored = candidates
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      score: fuzzyScore(proposedName, candidate.name),
    }))
    .filter((candidate) => candidate.score >= 0.6)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) {
    return { confidence: 0.4, matchCandidates: [] };
  }

  return {
    matchId:
      best.score >= DM2_EXISTING_VALUE_MATCH_THRESHOLD ? best.id : undefined,
    matchName:
      best.score >= DM2_EXISTING_VALUE_MATCH_THRESHOLD ? best.name : undefined,
    confidence: best.score,
    matchCandidates: scored.slice(0, 5),
  };
}

function defaultAction(
  matchId: string | undefined,
  confidence: number
): Dm2LookupProposalAction {
  if (matchId && confidence >= DM2_EXISTING_VALUE_MATCH_THRESHOLD) {
    return "use_existing";
  }
  if (!matchId) return "pending";
  return "pending";
}

function upsertProposal(
  map: Map<string, Dm2LookupProposal>,
  proposal: Dm2LookupProposal
) {
  const existing = map.get(proposal.normalizedKey);
  if (!existing) {
    map.set(proposal.normalizedKey, proposal);
    return;
  }
  existing.referenceCount += proposal.referenceCount;
  for (const file of proposal.sourceFiles) {
    if (!existing.sourceFiles.includes(file)) {
      existing.sourceFiles.push(file);
    }
  }
}

function buildProposalNormalizedKey(
  entityType: Dm2LookupProposal["entityType"],
  proposedName: string,
  manufacturerName?: string
): string {
  let normalizedKey = `${entityType}:${normalizeKey(proposedName)}`;
  if (entityType === "brand" && manufacturerName) {
    normalizedKey = `${entityType}:${normalizeKey(manufacturerName)}:${normalizeKey(proposedName)}`;
  }
  return normalizedKey;
}

function matchEntityToCatalog(
  entityType: Dm2LookupProposal["entityType"],
  proposedName: string,
  catalog: Dm2ImportCatalogContext,
  manufacturerName?: string
): {
  matchId?: string;
  matchName?: string;
  confidence: number;
  matchCandidates: Array<{ id: string; name: string; score: number }>;
} {
  if (entityType === "sport") {
    return findBestMatch(
      proposedName,
      catalog.sports.map((sport) => ({
        id: sport.id,
        name: sport.label,
        active: sport.active,
      }))
    );
  }

  if (entityType === "brand") {
    const manufacturerKey = manufacturerName ? normalizeKey(manufacturerName) : null;
    return findBestMatch(
      proposedName,
      catalog.brands
        .filter(
          (brand) =>
            !manufacturerKey ||
            normalizeKey(brand.manufacturerName) === manufacturerKey
        )
        .map((brand) => ({
          id: brand.id,
          name: brand.name,
          active: brand.active,
        }))
    );
  }

  if (entityType === "manufacturer") {
    return findBestMatch(
      proposedName,
      catalog.manufacturers.map((item) => ({
        id: item.id,
        name: item.name,
        active: item.active,
      }))
    );
  }

  if (entityType === "cardSetCategory") {
    return findBestMatch(
      proposedName,
      catalog.cardSetCategories.map((item) => ({
        id: item.id,
        name: item.name,
        active: item.active,
      }))
    );
  }

  if (entityType === "cardSetName") {
    return findBestMatch(
      proposedName,
      catalog.cardSetNames.map((item) => ({
        id: item.id,
        name: item.name,
        active: item.active,
      }))
    );
  }

  return findBestMatch(
    proposedName,
    catalog.parallels.map((item) => ({
      id: item.id,
      name: item.name,
      active: item.active,
    }))
  );
}

function buildLookupProposals(
  rows: Dm2ExtractedRow[],
  catalog: Dm2ImportCatalogContext
): Dm2LookupProposal[] {
  const proposals = new Map<string, Dm2LookupProposal>();

  const addSimpleProposal = (
    entityType: Dm2LookupProposal["entityType"],
    proposedName: string | undefined,
    sourceFileName: string,
    manufacturerName?: string
  ) => {
    if (!proposedName) return;

    const proposedKey = normalizeKey(proposedName);
    if (entityType === "cardSetName") {
      const isCatalogParallel = catalog.parallels.some(
        (parallel) => normalizeKey(parallel.name) === proposedKey
      );
      const isCatalogSetName = catalog.cardSetNames.some(
        (setName) => normalizeKey(setName.name) === proposedKey
      );
      if (isCatalogParallel && !isCatalogSetName) return;
    }

    let normalizedKey = buildProposalNormalizedKey(
      entityType,
      proposedName,
      manufacturerName
    );

    if (proposals.has(normalizedKey)) {
      const existing = proposals.get(normalizedKey)!;
      existing.referenceCount += 1;
      if (!existing.sourceFiles.includes(sourceFileName)) {
        existing.sourceFiles.push(sourceFileName);
      }
      return;
    }

    let matchResult: ReturnType<typeof findBestMatch>;
    if (entityType === "sport") {
      matchResult = matchEntityToCatalog(entityType, proposedName, catalog);
    } else if (entityType === "brand") {
      matchResult = matchEntityToCatalog(
        entityType,
        proposedName,
        catalog,
        manufacturerName
      );
    } else if (entityType === "manufacturer") {
      matchResult = matchEntityToCatalog(entityType, proposedName, catalog);
    } else if (entityType === "cardSetCategory") {
      matchResult = matchEntityToCatalog(entityType, proposedName, catalog);
    } else if (entityType === "cardSetName") {
      matchResult = matchEntityToCatalog(entityType, proposedName, catalog);
    } else {
      matchResult = matchEntityToCatalog(entityType, proposedName, catalog);
    }

    upsertProposal(proposals, {
      id: createId(),
      entityType,
      proposedName,
      normalizedKey,
      matchId: matchResult.matchId,
      matchName: matchResult.matchName,
      matchCandidates: matchResult.matchCandidates,
      confidence: matchResult.confidence,
      action: defaultAction(matchResult.matchId, matchResult.confidence),
      referenceCount: 1,
      manufacturerName,
      sourceFiles: [sourceFileName],
    });
  };

  for (const row of rows) {
    if (row.excluded) continue;
    addSimpleProposal("sport", row.sport, row.sourceFileName);
    addSimpleProposal("manufacturer", row.manufacturer, row.sourceFileName);
    addSimpleProposal(
      "brand",
      row.brand,
      row.sourceFileName,
      row.manufacturer
    );
    addSimpleProposal(
      "cardSetCategory",
      row.cardSetCategory,
      row.sourceFileName
    );
    addSimpleProposal("cardSetName", row.cardSetName, row.sourceFileName);
    if (row.parallel) {
      addSimpleProposal("parallel", row.parallel, row.sourceFileName);
    }
  }

  return [...proposals.values()].sort((a, b) =>
    a.entityType.localeCompare(b.entityType)
  );
}

function cardKey(row: Dm2ExtractedRow): string {
  return [
    normalizeKey(row.sport ?? ""),
    String(row.year ?? ""),
    normalizeKey(row.manufacturer ?? ""),
    normalizeKey(row.brand ?? ""),
    normalizeKey(row.cardSetCategory ?? ""),
    normalizeKey(row.cardSetName ?? ""),
    normalizeKey(row.cardNumber ?? ""),
    normalizeKey(row.player ?? ""),
    normalizeKey(row.parallel ?? ""),
  ].join("|");
}

/** Skip per-row missing-field issues above this row count (summary stats still computed). */
export const DM2_IMPORT_LARGE_ISSUE_ROW_THRESHOLD = 5_000;

function buildIssues(
  rows: Dm2ExtractedRow[],
  proposals: Dm2LookupProposal[],
  sessionContext: Dm2ImportSessionContext,
  duplicateResolutions?: Record<string, Dm2DuplicateResolution>
): Dm2ImportIssue[] {
  const issues: Dm2ImportIssue[] = [];
  const summarizeRowIssues = rows.length > DM2_IMPORT_LARGE_ISSUE_ROW_THRESHOLD;
  const rowById = summarizeRowIssues
    ? new Map(rows.map((row) => [row.id, row]))
    : null;

  const contextFields: Array<[keyof Dm2ImportSessionContext, string]> = [
    ["sport", "Sport"],
    ["year", "Year"],
    ["manufacturer", "Manufacturer"],
    ["brand", "Brand"],
    ["cardSetCategory", "Card Set Category"],
    ["cardSetName", "Card Set Name"],
  ];

  const contextValues = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.excluded) continue;
    for (const [field] of contextFields) {
      const value = row[field];
      if (value == null || value === "") continue;
      const key = String(field);
      if (!contextValues.has(key)) contextValues.set(key, new Set());
      contextValues.get(key)!.add(String(value));
    }
  }

  for (const [field, label] of contextFields) {
    const values = contextValues.get(field);
    if (!sessionContext[field] && values?.size === 1) {
      sessionContext[field] = [...values][0] as never;
    }
  }

  for (const proposal of proposals) {
    if (proposal.action === "pending" && !proposal.matchId) {
      issues.push({
        id: createId(),
        type:
          proposal.matchCandidates && proposal.matchCandidates.length > 1
            ? "AMBIGUOUS_MATCH"
            : "UNRESOLVED_LOOKUP",
        severity: "blocking",
        message: `Unresolved ${proposal.entityType}: "${proposal.proposedName}"`,
        proposalId: proposal.id,
      });
    } else if (
      proposal.confidence < DM2_EXISTING_VALUE_MATCH_THRESHOLD &&
      proposal.matchId
    ) {
      issues.push({
        id: createId(),
        type: "LOW_CONFIDENCE",
        severity: "warning",
        message: `Low-confidence match for ${proposal.entityType} "${proposal.proposedName}" → "${proposal.matchName}"`,
        proposalId: proposal.id,
      });
    }
  }

  const seenExact = new Map<string, string[]>();
  const seenNear = new Map<string, string[]>();

  const missingRequiredCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.excluded) continue;

    const required: Array<[string, string | number | undefined]> = [
      ["Sport", row.sport],
      ["Year", row.year],
      ["Manufacturer", row.manufacturer],
      ["Brand", row.brand],
      ["Card Set Category", row.cardSetCategory],
      ["Card Set Name", row.cardSetName],
      ["Card Number", row.cardNumber],
      ["Player", row.player],
    ];

    for (const [label, value] of required) {
      if (value == null || value === "") {
        if (summarizeRowIssues) {
          missingRequiredCounts.set(
            label,
            (missingRequiredCounts.get(label) ?? 0) + 1
          );
        } else {
          issues.push({
            id: createId(),
            type: "MISSING_REQUIRED",
            severity: "blocking",
            message: `Row ${row.sourceRowIndex} (${row.sourceFileName}): missing ${label}`,
            rowIds: [row.id],
          });
        }
      }
    }

    if (!summarizeRowIssues && row.confidence < 0.5) {
      issues.push({
        id: createId(),
        type: "LOW_CONFIDENCE",
        severity: "warning",
        message: `Row ${row.sourceRowIndex} (${row.sourceFileName}): low extraction confidence`,
        rowIds: [row.id],
      });
    }

    if (!summarizeRowIssues && row.unsupportedFields && Object.keys(row.unsupportedFields).length > 0) {
      issues.push({
        id: createId(),
        type: "UNSUPPORTED_FIELD",
        severity: "warning",
        message: `Row ${row.sourceRowIndex} (${row.sourceFileName}): unsupported fields detected (${Object.keys(row.unsupportedFields).join(", ")})`,
        rowIds: [row.id],
      });
    }

    if (row.cardNumber && row.player) {
      const exactKey = cardKey(row);
      const nearKey = [
        normalizeKey(row.sport ?? ""),
        String(row.year ?? ""),
        normalizeKey(row.manufacturer ?? ""),
        normalizeKey(row.brand ?? ""),
        normalizeKey(row.cardSetCategory ?? ""),
        normalizeKey(row.cardSetName ?? ""),
        normalizeKey(row.cardNumber ?? ""),
        normalizeKey(row.parallel ?? ""),
      ].join("|");

      if (!seenExact.has(exactKey)) seenExact.set(exactKey, []);
      seenExact.get(exactKey)!.push(row.id);

      if (!seenNear.has(nearKey)) seenNear.set(nearKey, []);
      seenNear.get(nearKey)!.push(row.id);
    }
  }

  for (const [, rowIds] of seenExact) {
    if (rowIds.length > 1) {
      const key = duplicateGroupKey("DUPLICATE_EXACT", rowIds);
      if (duplicateResolutions?.[key]?.action === "not_duplicate") continue;

      issues.push({
        id: createId(),
        type: "DUPLICATE_EXACT",
        severity: "warning",
        message: `Exact duplicate cards detected (${rowIds.length} rows)`,
        rowIds,
      });
    }
  }

  if (summarizeRowIssues) {
    for (const [label, count] of missingRequiredCounts) {
      if (count === 0) continue;
      issues.push({
        id: createId(),
        type: "MISSING_REQUIRED",
        severity: "blocking",
        message: `${count.toLocaleString()} row(s) missing ${label}`,
      });
    }
  }

  for (const [, rowIds] of seenNear) {
    if (rowIds.length > 1) {
      const uniquePlayers = new Set(
        rowIds
          .map((id) => (rowById ? rowById.get(id)?.player : rows.find((row) => row.id === id)?.player))
          .filter(Boolean)
          .map((player) => normalizeKey(player!))
      );
      if (uniquePlayers.size > 1) {
        const key = duplicateGroupKey("DUPLICATE_NEAR", rowIds);
        if (duplicateResolutions?.[key]?.action === "not_duplicate") continue;

        issues.push({
          id: createId(),
          type: "DUPLICATE_NEAR",
          severity: "warning",
          message: `Possible near-duplicate cards with different player names`,
          rowIds,
        });
      }
    }
  }

  return issues;
}

function buildSuggestionIssues(suggestions: Dm2FieldSuggestion[]): Dm2ImportIssue[] {
  return suggestions
    .filter((suggestion) => !suggestion.applied)
    .map((suggestion) => ({
      id: createId(),
      type: "MAPPING_SUGGESTION" as const,
      severity: "warning" as const,
      message: `Suggest ${suggestion.field}: "${suggestion.currentValue ?? "—"}" → "${suggestion.suggestedValue}" (${suggestion.source}: ${suggestion.reason})`,
      rowIds: suggestion.rowId ? [suggestion.rowId] : undefined,
    }));
}

export function applyDm2Suggestion(
  session: Dm2ImportSession,
  suggestionId: string,
  overrideValue?: string | number
): Dm2ImportSession {
  const suggestion = session.suggestions.find((item) => item.id === suggestionId);
  if (!suggestion || suggestion.applied) return session;

  const value = overrideValue ?? suggestion.suggestedValue;
  const suggestions = session.suggestions.map((item) =>
    item.id === suggestionId
      ? { ...item, suggestedValue: value, applied: true }
      : item
  );

  let sessionContext = { ...session.sessionContext };
  let rows = session.rows.map((row) => ({ ...row }));

  if (suggestion.rowId) {
    rows = rows.map((row) => {
      if (row.id !== suggestion.rowId) return row;
      if (suggestion.field === "year") {
        const year = asYearValue(value);
        return year ? { ...row, year } : row;
      }
      return {
        ...row,
        [suggestion.field]: String(value),
      };
    });
  } else if (
    ["sport", "year", "manufacturer", "brand", "cardSetCategory", "cardSetName"].includes(
      suggestion.field
    )
  ) {
    if (suggestion.field === "year") {
      const year = asYearValue(value);
      if (year) sessionContext.year = year;
    } else {
      sessionContext[suggestion.field as keyof Dm2ImportSessionContext] = String(
        value
      ) as never;
    }
  }

  return rebuildDm2ImportSession({
    ...session,
    sessionContext,
    rows,
    suggestions,
  });
}

function asYearValue(value: string | number): number | undefined {
  const year = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(year) || year < 1800 || year > 2100) return undefined;
  return year;
}

export function computeDm2FieldStats(rows: Dm2ExtractedRow[]): Dm2ImportFieldStats {
  const fields: Array<keyof Dm2ImportFieldStats> = [
    "sport",
    "year",
    "manufacturer",
    "brand",
    "cardSetCategory",
    "cardSetName",
    "parallel",
  ];

  const stats: Dm2ImportFieldStats = {
    sport: 0,
    year: 0,
    manufacturer: 0,
    brand: 0,
    cardSetCategory: 0,
    cardSetName: 0,
    parallel: 0,
  };

  for (const field of fields) {
    const values = new Set<string>();
    for (const row of rows) {
      if (row.excluded) continue;
      const value = row[field as keyof Dm2ExtractedRow];
      if (value == null || value === "") continue;
      values.add(String(value));
    }
    stats[field] = values.size;
  }

  return stats;
}

export function buildDm2ImportSession(input: {
  id: string;
  files: Dm2ImportSession["files"];
  contexts: Dm2ImportSessionContext[];
  rows: Dm2ExtractedRow[];
  model: string;
  promptVersion: string;
  catalog: Dm2ImportCatalogContext;
  sessionContext?: Dm2ImportSessionContext;
  suggestions?: Dm2FieldSuggestion[];
  researchNotes?: Dm2ImportResearchNote[];
  mappingFramework?: Dm2MappingFrameworkNote[];
}): Dm2ImportSession {
  const sessionContext =
    input.sessionContext ?? mergeContext(input.contexts);
  const hintedRows = applyCatalogCardSetHintsToRows(input.rows, input.catalog);
  const contextualRows = applySessionContextToRows(hintedRows, sessionContext);
  const rows = reconcileExtractedRowsWithCatalogParallels(
    contextualRows,
    input.catalog
  );
  const proposals = buildLookupProposals(rows, input.catalog);
  const issues = [
    ...buildIssues(rows, proposals, sessionContext),
    ...buildSuggestionIssues(input.suggestions ?? []),
  ];

  return {
    id: input.id,
    files: input.files,
    sessionContext,
    rows,
    proposals,
    issues,
    suggestions: input.suggestions ?? [],
    researchNotes: input.researchNotes ?? [],
    mappingFramework: input.mappingFramework ?? [],
    model: input.model,
    promptVersion: input.promptVersion,
    catalog: input.catalog,
  };
}

function entityTypeToRowField(
  entityType: Dm2LookupProposal["entityType"]
): keyof Dm2ExtractedRow | null {
  switch (entityType) {
    case "sport":
      return "sport";
    case "manufacturer":
      return "manufacturer";
    case "brand":
      return "brand";
    case "cardSetCategory":
      return "cardSetCategory";
    case "cardSetName":
      return "cardSetName";
    case "parallel":
      return "parallel";
    default:
      return null;
  }
}

function entityTypeToContextField(
  entityType: Dm2LookupProposal["entityType"]
): keyof Dm2ImportSessionContext | null {
  switch (entityType) {
    case "sport":
      return "sport";
    case "manufacturer":
      return "manufacturer";
    case "brand":
      return "brand";
    case "cardSetCategory":
      return "cardSetCategory";
    case "cardSetName":
      return "cardSetName";
    default:
      return null;
  }
}

function mergeProposalActions(
  previous: Dm2LookupProposal[],
  next: Dm2LookupProposal[]
): Dm2LookupProposal[] {
  const previousByKey = new Map(
    previous.map((proposal) => [proposal.normalizedKey, proposal])
  );

  return next.map((proposal) => {
    const prior = previousByKey.get(proposal.normalizedKey);
    if (!prior) return proposal;
    return {
      ...proposal,
      action: prior.action,
      matchId: prior.matchId,
      matchName: prior.matchName,
    };
  });
}

export function rebuildDm2ImportSession(
  session: Dm2ImportSession
): Dm2ImportSession {
  if (!session.catalog) return session;

  const previousProposals = session.proposals;
  const rowsWithResolutions = applyStoredDuplicateResolutions(session);
  const rebuilt = buildDm2ImportSession({
    id: session.id,
    files: session.files,
    contexts: [session.sessionContext],
    sessionContext: session.sessionContext,
    rows: rowsWithResolutions,
    model: session.model,
    promptVersion: session.promptVersion,
    catalog: session.catalog,
    suggestions: session.suggestions,
    researchNotes: session.researchNotes,
    mappingFramework: session.mappingFramework,
  });

  const mergedProposals = mergeProposalActions(
    previousProposals,
    rebuilt.proposals
  );
  const issues = [
    ...buildIssues(
      rebuilt.rows,
      mergedProposals,
      rebuilt.sessionContext,
      session.duplicateResolutions
    ),
    ...buildSuggestionIssues(session.suggestions ?? []),
  ];

  return {
    ...rebuilt,
    proposals: mergedProposals,
    issues,
    catalog: session.catalog,
    reviewProgress: session.reviewProgress,
    duplicateResolutions: session.duplicateResolutions,
  };
}

export function updateDm2SessionContextField(
  session: Dm2ImportSession,
  field: keyof Dm2ImportSessionContext,
  value: string
): Dm2ImportSession {
  const sessionContext = { ...session.sessionContext };

  if (field === "year") {
    if (!value.trim()) {
      sessionContext.year = undefined;
    } else {
      const year = asYearValue(value);
      if (!year) return session;
      sessionContext.year = year;
    }
  } else {
    const trimmed = value.trim();
    sessionContext[field] = trimmed || undefined;
  }

  const rows = session.rows.map((row) => {
    const current = row[field];
    if (current != null && current !== "") return row;
    if (field === "year") {
      return { ...row, year: sessionContext.year };
    }
    return { ...row, [field]: sessionContext[field] };
  });

  return rebuildDm2ImportSession({ ...session, sessionContext, rows });
}

export function updateDm2ProposalProposedName(
  session: Dm2ImportSession,
  proposalId: string,
  proposedName: string
): Dm2ImportSession {
  const proposal = session.proposals.find((item) => item.id === proposalId);
  if (!proposal || !session.catalog) return session;

  const trimmed = proposedName.trim();
  if (!trimmed || trimmed === proposal.proposedName) return session;

  const field = entityTypeToRowField(proposal.entityType);
  if (!field) return session;

  const newNormalizedKey = buildProposalNormalizedKey(
    proposal.entityType,
    trimmed,
    proposal.manufacturerName
  );
  const mergeTarget = session.proposals.find(
    (item) => item.id !== proposalId && item.normalizedKey === newNormalizedKey
  );
  if (mergeTarget) {
    return mergeDm2ProposalReferences(session, proposalId, mergeTarget.id);
  }

  const rows = session.rows.map((row) => {
    if (!rowReferencesProposal(row, proposal)) return row;
    return { ...row, [field]: trimmed };
  });

  const sessionContext = { ...session.sessionContext };
  const contextField = entityTypeToContextField(proposal.entityType);
  if (contextField) {
    const contextValue = sessionContext[contextField];
    if (
      contextValue != null &&
      normalizeKey(String(contextValue)) === normalizeKey(proposal.proposedName)
    ) {
      if (contextField === "year") {
        const year = asYearValue(trimmed);
        if (year) sessionContext.year = year;
      } else {
        sessionContext[contextField] = trimmed;
      }
    }
  }

  const matchResult = matchEntityToCatalog(
    proposal.entityType,
    trimmed,
    session.catalog,
    proposal.manufacturerName
  );

  const preservedCreateNew = proposal.action === "create_new";
  let nextAction = proposal.action;
  let nextMatchId = proposal.matchId;
  let nextMatchName = proposal.matchName;

  if (preservedCreateNew) {
    nextAction = "create_new";
    nextMatchId = undefined;
    nextMatchName = undefined;
  } else if (proposal.action === "use_existing") {
    if (
      matchResult.matchId &&
      matchResult.confidence >= DM2_EXISTING_VALUE_MATCH_THRESHOLD
    ) {
      nextAction = "use_existing";
      nextMatchId = matchResult.matchId;
      nextMatchName = matchResult.matchName;
    } else {
      nextAction = "pending";
      nextMatchId = undefined;
      nextMatchName = undefined;
    }
  } else {
    nextAction = defaultAction(matchResult.matchId, matchResult.confidence);
    nextMatchId =
      nextAction === "use_existing" ? matchResult.matchId : undefined;
    nextMatchName =
      nextAction === "use_existing" ? matchResult.matchName : undefined;
  }

  const proposals = session.proposals.map((item) => {
    if (item.id !== proposalId) return item;
    return {
      ...item,
      proposedName: trimmed,
      normalizedKey: newNormalizedKey,
      matchId: nextMatchId,
      matchName: nextMatchName,
      matchCandidates: matchResult.matchCandidates,
      confidence: matchResult.confidence,
      action: nextAction,
    };
  });

  const issues = [
    ...buildIssues(
      rows,
      proposals,
      sessionContext,
      session.duplicateResolutions
    ),
    ...buildSuggestionIssues(session.suggestions ?? []),
  ];

  return {
    ...session,
    rows,
    sessionContext,
    proposals,
    issues,
  };
}

function rowReferencesProposal(
  row: Dm2ExtractedRow,
  proposal: Dm2LookupProposal
): boolean {
  if (row.excluded) return false;

  const field = entityTypeToRowField(proposal.entityType);
  if (!field) return false;

  const rowValue = row[field];
  if (rowValue == null || rowValue === "") return false;

  if (normalizeKey(String(rowValue)) !== normalizeKey(proposal.proposedName)) {
    return false;
  }

  if (proposal.entityType === "brand" && proposal.manufacturerName) {
    if (
      !row.manufacturer ||
      normalizeKey(row.manufacturer) !== normalizeKey(proposal.manufacturerName)
    ) {
      return false;
    }
  }

  return true;
}

/** Move all row references from one lookup proposal to another, removing the source. */
export function mergeDm2ProposalReferences(
  session: Dm2ImportSession,
  sourceProposalId: string,
  targetProposalId: string
): Dm2ImportSession {
  if (sourceProposalId === targetProposalId) return session;

  const source = session.proposals.find((item) => item.id === sourceProposalId);
  const target = session.proposals.find((item) => item.id === targetProposalId);
  if (!source || !target) return session;
  if (source.entityType !== target.entityType) return session;
  if (
    source.entityType === "brand" &&
    normalizeKey(source.manufacturerName ?? "") !==
      normalizeKey(target.manufacturerName ?? "")
  ) {
    return session;
  }

  const field = entityTypeToRowField(source.entityType);
  if (!field) return session;

  const targetName = target.proposedName;
  const rows = session.rows.map((row) => {
    if (!rowReferencesProposal(row, source)) return row;
    return { ...row, [field]: targetName };
  });

  const sessionContext = { ...session.sessionContext };
  const contextField = entityTypeToContextField(source.entityType);
  if (contextField) {
    const contextValue = sessionContext[contextField];
    if (
      contextValue != null &&
      normalizeKey(String(contextValue)) === normalizeKey(source.proposedName)
    ) {
      if (contextField === "year") {
        const year = asYearValue(targetName);
        if (year) sessionContext.year = year;
      } else {
        sessionContext[contextField] = targetName;
      }
    }
  }

  return rebuildDm2ImportSession({ ...session, rows, sessionContext });
}

export function getMergeTargetProposals(
  session: Dm2ImportSession,
  sourceProposalId: string
): Dm2LookupProposal[] {
  const source = session.proposals.find((item) => item.id === sourceProposalId);
  if (!source) return [];

  return session.proposals
    .filter((proposal) => {
      if (proposal.id === sourceProposalId) return false;
      if (proposal.entityType !== source.entityType) return false;
      if (source.entityType === "brand") {
        return (
          normalizeKey(proposal.manufacturerName ?? "") ===
          normalizeKey(source.manufacturerName ?? "")
        );
      }
      return true;
    })
    .sort((a, b) => a.proposedName.localeCompare(b.proposedName));
}

/** Clear parallel from all rows referencing a parallel proposal (not a real parallel). */
export function clearDm2ParallelProposal(
  session: Dm2ImportSession,
  proposalId: string
): Dm2ImportSession {
  const proposal = session.proposals.find((item) => item.id === proposalId);
  if (!proposal || proposal.entityType !== "parallel") return session;

  const rows = session.rows.map((row) => {
    if (!rowReferencesProposal(row, proposal)) return row;
    return { ...row, parallel: undefined };
  });

  return rebuildDm2ImportSession({ ...session, rows });
}

export type Dm2EditableRowFields = Pick<
  Dm2ExtractedRow,
  | "sport"
  | "year"
  | "manufacturer"
  | "brand"
  | "cardSetCategory"
  | "cardSetName"
  | "cardNumber"
  | "player"
  | "parallel"
>;

export function updateDm2RowFields(
  session: Dm2ImportSession,
  rowId: string,
  updates: Partial<Dm2EditableRowFields>
): Dm2ImportSession {
  const rows = session.rows.map((row) => {
    if (row.id !== rowId) return row;

    const next = { ...row };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if (key === "year") {
        const year =
          typeof value === "number" ? value : asYearValue(String(value));
        next.year = year;
        continue;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        next[key as keyof Dm2EditableRowFields] = (trimmed || undefined) as never;
      }
    }
    return next;
  });

  return rebuildDm2ImportSession({ ...session, rows });
}

export function updateDm2SuggestionValue(
  session: Dm2ImportSession,
  suggestionId: string,
  suggestedValue: string | number
): Dm2ImportSession {
  return {
    ...session,
    suggestions: session.suggestions.map((suggestion) =>
      suggestion.id === suggestionId
        ? { ...suggestion, suggestedValue }
        : suggestion
    ),
  };
}

export function updateDm2ProposalAction(
  session: Dm2ImportSession,
  proposalId: string,
  action: Dm2LookupProposalAction,
  matchId?: string,
  matchName?: string
): Dm2ImportSession {
  const proposals = session.proposals.map((proposal) => {
    if (proposal.id !== proposalId) return proposal;
    return {
      ...proposal,
      action,
      matchId: action === "use_existing" ? matchId ?? proposal.matchId : undefined,
      matchName:
        action === "use_existing" ? matchName ?? proposal.matchName : undefined,
    };
  });

  return rebuildDm2ImportSession({ ...session, proposals });
}

function resolvedLookupValue(proposal: Dm2LookupProposal): string | undefined {
  if (proposal.action === "use_existing" && proposal.matchName) {
    return proposal.matchName;
  }
  if (proposal.action === "create_new") {
    return proposal.proposedName;
  }
  return undefined;
}

function rowMatchesProposal(
  row: Dm2ExtractedRow,
  proposal: Dm2LookupProposal
): boolean {
  const field = entityTypeToRowField(proposal.entityType);
  if (!field) return false;

  const rowValue = row[field];
  if (rowValue == null || rowValue === "") return false;

  const normalizedRow = normalizeKey(String(rowValue));
  return (
    normalizedRow === proposal.normalizedKey ||
    normalizedRow === normalizeKey(proposal.proposedName)
  );
}

/** Apply finalized lookup decisions to card rows before the cards review step. */
export function applyResolvedLookupsToRows(
  session: Dm2ImportSession
): Dm2ImportSession {
  const rows = session.rows.map((row) => {
    let next = { ...row };

    for (const proposal of session.proposals) {
      if (proposal.action === "pending") continue;

      const resolved = resolvedLookupValue(proposal);
      if (!resolved) continue;

      const field = entityTypeToRowField(proposal.entityType);
      if (!field || !rowMatchesProposal(next, proposal)) continue;

      next = { ...next, [field]: resolved };
    }

    return next;
  });

  return rebuildDm2ImportSession({ ...session, rows });
}

export function getPendingProposalCount(session: Dm2ImportSession): number {
  return session.proposals.filter(
    (proposal) =>
      proposal.action !== "create_new" && proposal.action !== "use_existing"
  ).length;
}

export function getLookupBlockingIssueCount(session: Dm2ImportSession): number {
  return session.issues.filter(
    (issue) =>
      issue.severity === "blocking" &&
      (issue.type === "UNRESOLVED_LOOKUP" || issue.type === "AMBIGUOUS_MATCH")
  ).length;
}

export function getLookupWarningIssueCount(session: Dm2ImportSession): number {
  return session.issues.filter(
    (issue) =>
      issue.severity === "warning" &&
      issue.proposalId != null &&
      issue.type === "LOW_CONFIDENCE"
  ).length;
}

export const DM2_LOOKUP_ROW_FIELDS = [
  "sport",
  "manufacturer",
  "brand",
  "cardSetCategory",
  "cardSetName",
  "parallel",
] as const;

export type Dm2LookupRowField = (typeof DM2_LOOKUP_ROW_FIELDS)[number];

export function isLookupRowField(
  field: keyof Dm2EditableRowFields
): field is Dm2LookupRowField {
  return (DM2_LOOKUP_ROW_FIELDS as readonly string[]).includes(field);
}

export function getRowMissingRequiredFields(
  row: Dm2ExtractedRow
): Array<keyof Dm2EditableRowFields> {
  if (row.excluded) return [];

  const missing: Array<keyof Dm2EditableRowFields> = [];
  if (!row.sport?.trim()) missing.push("sport");
  if (row.year == null) missing.push("year");
  if (!row.manufacturer?.trim()) missing.push("manufacturer");
  if (!row.brand?.trim()) missing.push("brand");
  if (!row.cardSetCategory?.trim()) missing.push("cardSetCategory");
  if (!row.cardSetName?.trim()) missing.push("cardSetName");
  if (!row.cardNumber?.trim()) missing.push("cardNumber");
  if (!row.player?.trim()) missing.push("player");
  return missing;
}

export function getBlockingRowIds(session: Dm2ImportSession): Set<string> {
  return new Set(
    session.issues
      .filter((issue) => issue.severity === "blocking" && issue.rowIds?.length)
      .flatMap((issue) => issue.rowIds ?? [])
  );
}

export function isDuplicateIssue(issue: Dm2ImportIssue): boolean {
  return issue.type === "DUPLICATE_EXACT" || issue.type === "DUPLICATE_NEAR";
}

export function duplicateGroupKey(
  issueType: "DUPLICATE_EXACT" | "DUPLICATE_NEAR",
  rowIds: string[]
): string {
  return `${issueType}:${[...rowIds].sort().join("|")}`;
}

export function getDuplicateResolution(
  session: Dm2ImportSession,
  issue: Dm2ImportIssue
): Dm2DuplicateResolution | undefined {
  if (!issue.rowIds?.length || !isDuplicateIssue(issue)) return undefined;
  const key = duplicateGroupKey(issue.type as "DUPLICATE_EXACT" | "DUPLICATE_NEAR", issue.rowIds);
  return session.duplicateResolutions?.[key];
}

export function getDuplicateIssueCount(session: Dm2ImportSession): number {
  return session.issues.filter(isDuplicateIssue).length;
}

export function cardSetParallelKey(row: Dm2ExtractedRow): string {
  return [
    normalizeKey(row.sport ?? ""),
    String(row.year ?? ""),
    normalizeKey(row.manufacturer ?? ""),
    normalizeKey(row.brand ?? ""),
    normalizeKey(row.cardSetCategory ?? ""),
    normalizeKey(row.cardSetName ?? ""),
    normalizeKey(row.parallel ?? ""),
  ].join("|");
}

function formatDuplicateClusterLabel(row: Dm2ExtractedRow): string {
  const parts = [
    row.year != null ? String(row.year) : undefined,
    row.sport,
    row.brand,
    row.cardSetCategory,
    row.cardSetName,
  ].filter((value) => value != null && String(value).trim() !== "");
  return parts.join(" · ") || row.cardSetName?.trim() || "Unknown card set";
}

export interface Dm2DuplicateBulkParallelCluster {
  key: string;
  cardSetLabel: string;
  parallelLabel: string;
  duplicateRowIds: string[];
  duplicateGroupCount: number;
  totalMatchingRowCount: number;
  hasExactDuplicates: boolean;
  hasNearDuplicates: boolean;
}

export function getDuplicateBulkParallelClusters(
  session: Dm2ImportSession
): Dm2DuplicateBulkParallelCluster[] {
  const duplicateIssues = session.issues.filter(isDuplicateIssue);
  const rowsById = new Map(session.rows.map((row) => [row.id, row]));

  const duplicateRowIds = new Set<string>();
  const rowIdsByKey = new Map<string, Set<string>>();
  const groupsByKey = new Map<string, number>();
  const issueTypesByKey = new Map<string, Set<string>>();

  for (const issue of duplicateIssues) {
    const issueRowIds = issue.rowIds ?? [];
    if (issueRowIds.length < 2) continue;

    const issueRows = issueRowIds
      .map((id) => rowsById.get(id))
      .filter((row): row is Dm2ExtractedRow => row != null && !row.excluded);
    if (issueRows.length < 2) continue;

    const issueKey = cardSetParallelKey(issueRows[0]);
    const sameCardSetParallel = issueRows.every(
      (row) => cardSetParallelKey(row) === issueKey
    );
    if (!sameCardSetParallel) continue;

    groupsByKey.set(issueKey, (groupsByKey.get(issueKey) ?? 0) + 1);
    if (!issueTypesByKey.has(issueKey)) {
      issueTypesByKey.set(issueKey, new Set());
    }
    issueTypesByKey.get(issueKey)!.add(issue.type);

    if (!rowIdsByKey.has(issueKey)) {
      rowIdsByKey.set(issueKey, new Set());
    }
    const bucket = rowIdsByKey.get(issueKey)!;
    for (const row of issueRows) {
      duplicateRowIds.add(row.id);
      bucket.add(row.id);
    }
  }

  const totalMatchingByKey = new Map<string, number>();
  for (const row of session.rows) {
    if (row.excluded) continue;
    const key = cardSetParallelKey(row);
    if (!rowIdsByKey.has(key)) continue;
    totalMatchingByKey.set(key, (totalMatchingByKey.get(key) ?? 0) + 1);
  }

  return [...rowIdsByKey.entries()]
    .map(([key, rowIdSet]) => {
      const sample = session.rows.find((row) => rowIdSet.has(row.id));
      if (!sample) return null;

      const issueTypes = issueTypesByKey.get(key) ?? new Set<string>();
      return {
        key,
        cardSetLabel: formatDuplicateClusterLabel(sample),
        parallelLabel: sample.parallel?.trim() || "(none)",
        duplicateRowIds: [...rowIdSet],
        duplicateGroupCount: groupsByKey.get(key) ?? 0,
        totalMatchingRowCount: totalMatchingByKey.get(key) ?? rowIdSet.size,
        hasExactDuplicates: issueTypes.has("DUPLICATE_EXACT"),
        hasNearDuplicates: issueTypes.has("DUPLICATE_NEAR"),
      };
    })
    .filter((cluster): cluster is Dm2DuplicateBulkParallelCluster => cluster != null)
    .sort(
      (a, b) =>
        b.duplicateRowIds.length - a.duplicateRowIds.length ||
        a.cardSetLabel.localeCompare(b.cardSetLabel)
    );
}

export function bulkUpdateDuplicateClusterParallel(
  session: Dm2ImportSession,
  cluster: Pick<
    Dm2DuplicateBulkParallelCluster,
    "key" | "duplicateRowIds"
  >,
  parallel: string,
  options?: { includeAllMatchingRows?: boolean }
): Dm2ImportSession {
  const trimmedParallel = parallel.trim();
  const duplicateIdSet = new Set(cluster.duplicateRowIds);

  const updated = bulkUpdateDm2Rows(
    session,
    (row) => {
      if (row.excluded) return false;
      if (options?.includeAllMatchingRows) {
        return cardSetParallelKey(row) === cluster.key;
      }
      return duplicateIdSet.has(row.id);
    },
    { parallel: trimmedParallel }
  );

  return {
    ...updated,
    duplicateResolutions: undefined,
  };
}

export function bulkUpdateDuplicateIssueParallel(
  session: Dm2ImportSession,
  issue: Dm2ImportIssue,
  parallel: string
): Dm2ImportSession {
  const rowIds = issue.rowIds ?? [];
  if (rowIds.length === 0 || !isDuplicateIssue(issue)) return session;

  const trimmedParallel = parallel.trim();
  const rowIdSet = new Set(rowIds);

  const updated = bulkUpdateDm2Rows(
    session,
    (row) => !row.excluded && rowIdSet.has(row.id),
    { parallel: trimmedParallel }
  );

  return {
    ...updated,
    duplicateResolutions: undefined,
  };
}

export function defaultKeepRowIdForDuplicateGroup(
  rows: Dm2ExtractedRow[],
  rowIds: string[]
): string {
  const groupRows = rows
    .filter((row) => rowIds.includes(row.id))
    .sort(
      (a, b) =>
        a.sourceFileName.localeCompare(b.sourceFileName) ||
        a.sourceRowIndex - b.sourceRowIndex
    );
  return groupRows[0]?.id ?? rowIds[0];
}

function applyStoredDuplicateResolutions(session: Dm2ImportSession): Dm2ExtractedRow[] {
  let rows = session.rows;

  for (const resolution of Object.values(session.duplicateResolutions ?? {})) {
    if (resolution.action === "confirmed_duplicate" && resolution.keepRowId) {
      const excludeIds = new Set(
        resolution.rowIds.filter((id) => id !== resolution.keepRowId)
      );
      rows = rows.map((row) =>
        excludeIds.has(row.id) ? { ...row, excluded: true } : row
      );
    }

    if (resolution.action === "not_duplicate") {
      const includeIds = new Set(resolution.rowIds);
      rows = rows.map((row) =>
        includeIds.has(row.id) ? { ...row, excluded: false } : row
      );
    }
  }

  return rows;
}

export function resolveDuplicateGroup(
  session: Dm2ImportSession,
  issue: Dm2ImportIssue,
  action: Dm2DuplicateResolutionAction,
  keepRowId?: string
): Dm2ImportSession {
  if (!issue.rowIds || issue.rowIds.length < 2 || !isDuplicateIssue(issue)) {
    return session;
  }

  const issueType = issue.type as "DUPLICATE_EXACT" | "DUPLICATE_NEAR";
  const key = duplicateGroupKey(issueType, issue.rowIds);
  const keep =
    action === "confirmed_duplicate"
      ? keepRowId ?? defaultKeepRowIdForDuplicateGroup(session.rows, issue.rowIds)
      : undefined;

  const duplicateResolutions = {
    ...(session.duplicateResolutions ?? {}),
    [key]: {
      action,
      issueType,
      rowIds: issue.rowIds,
      keepRowId: keep,
      resolvedAt: new Date().toISOString(),
    },
  };

  let rows = session.rows;
  const rowIdSet = new Set(issue.rowIds);

  if (action === "confirmed_duplicate" && keep) {
    rows = rows.map((row) => {
      if (!rowIdSet.has(row.id)) return row;
      return { ...row, excluded: row.id !== keep };
    });
  } else if (action === "not_duplicate") {
    rows = rows.map((row) =>
      rowIdSet.has(row.id) ? { ...row, excluded: false } : row
    );
  }

  return rebuildDm2ImportSession({
    ...session,
    rows,
    duplicateResolutions,
  });
}

function proposalDisplayName(proposal: Dm2LookupProposal): string {
  if (proposal.action === "use_existing" && proposal.matchName) {
    return proposal.matchName;
  }
  return proposal.proposedName;
}

function applyEditableFieldUpdate(
  row: Dm2ExtractedRow,
  key: string,
  rawValue: unknown
): Dm2ExtractedRow {
  const next = { ...row };
  if (key === "year") {
    const year =
      typeof rawValue === "number"
        ? rawValue
        : asYearValue(String(rawValue ?? ""));
    next.year = year;
    return next;
  }
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    next[key as keyof Dm2EditableRowFields] = (trimmed || undefined) as never;
  }
  return next;
}

export function getDm2LookupFieldOptions(
  session: Dm2ImportSession,
  field: Dm2LookupRowField,
  row?: Dm2ExtractedRow
): string[] {
  const values = new Set<string>();
  const catalog = session.catalog;

  if (catalog) {
    switch (field) {
      case "sport":
        catalog.sports
          .filter((item) => item.active)
          .forEach((item) => values.add(item.label));
        break;
      case "manufacturer":
        catalog.manufacturers
          .filter((item) => item.active)
          .forEach((item) => values.add(item.name));
        break;
      case "brand": {
        const manufacturerKey = row?.manufacturer
          ? normalizeKey(row.manufacturer)
          : null;
        catalog.brands
          .filter(
            (item) =>
              item.active &&
              (!manufacturerKey ||
                normalizeKey(item.manufacturerName) === manufacturerKey)
          )
          .forEach((item) => values.add(item.name));
        break;
      }
      case "cardSetCategory":
        catalog.cardSetCategories
          .filter((item) => item.active)
          .forEach((item) => values.add(item.name));
        break;
      case "cardSetName":
        catalog.cardSetNames
          .filter((item) => item.active)
          .forEach((item) => values.add(item.name));
        break;
      case "parallel":
        catalog.parallels
          .filter((item) => item.active)
          .forEach((item) => values.add(item.name));
        break;
    }
  }

  for (const proposal of session.proposals) {
    if (proposal.entityType !== field) continue;
    if (field === "brand" && row?.manufacturer && proposal.manufacturerName) {
      if (
        normalizeKey(proposal.manufacturerName) !== normalizeKey(row.manufacturer)
      ) {
        continue;
      }
    }
    values.add(proposalDisplayName(proposal));
    values.add(proposal.proposedName);
  }

  const contextValue =
    session.sessionContext[field as keyof Dm2ImportSessionContext];
  if (contextValue != null && contextValue !== "") {
    values.add(String(contextValue));
  }

  for (const importRow of session.rows) {
    const rowValue = importRow[field];
    if (rowValue != null && rowValue !== "") {
      values.add(String(rowValue));
    }
  }

  return [...values].sort((a, b) => a.localeCompare(b));
}

export function getBulkMissingLookupSummary(
  session: Dm2ImportSession
): Array<{
  cardSetName: string;
  field: Dm2LookupRowField;
  missingCount: number;
}> {
  const counts = new Map<string, number>();

  for (const row of session.rows) {
    if (row.excluded) continue;
    const setName = row.cardSetName?.trim();
    if (!setName) continue;

    const missing = getRowMissingRequiredFields(row).filter(isLookupRowField);
    for (const field of missing) {
      const key = `${setName}\0${field}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([key, missingCount]) => {
      const [cardSetName, field] = key.split("\0");
      return {
        cardSetName,
        field: field as Dm2LookupRowField,
        missingCount,
      };
    })
    .sort(
      (a, b) =>
        a.cardSetName.localeCompare(b.cardSetName) ||
        a.field.localeCompare(b.field)
    );
}

export function bulkUpdateDm2Rows(
  session: Dm2ImportSession,
  predicate: (row: Dm2ExtractedRow) => boolean,
  updates: Partial<Dm2EditableRowFields>,
  options?: { onlyMissingFields?: boolean; skipRebuild?: boolean }
): Dm2ImportSession {
  const rows = session.rows.map((row) => {
    if (row.excluded || !predicate(row)) return row;

    let next = { ...row };
    for (const [key, rawValue] of Object.entries(updates)) {
      if (rawValue === undefined) continue;
      if (options?.onlyMissingFields) {
        const current = next[key as keyof Dm2ExtractedRow];
        if (current != null && current !== "") continue;
      }
      next = applyEditableFieldUpdate(next, key, rawValue);
    }
    return next;
  });

  if (options?.skipRebuild) {
    return { ...session, rows };
  }

  return rebuildDm2ImportSession({ ...session, rows });
}

export function getBlockingIssueCount(session: Dm2ImportSession): number {
  return session.issues.filter((issue) => issue.severity === "blocking").length;
}

export function getReadyRowCount(session: Dm2ImportSession): number {
  const blockingRowIds = getBlockingRowIds(session);

  return session.rows.filter(
    (row) => !row.excluded && !blockingRowIds.has(row.id)
  ).length;
}

export type Dm2ReviewProgressStep = "lookups" | "cardSets" | "cards";

export interface Dm2ImportReviewStepCommitResult {
  session?: Dm2ImportSession;
  error?: string;
}

export function invalidateReviewProgressFrom(
  session: Dm2ImportSession,
  step: Dm2ReviewProgressStep
): Dm2ImportSession {
  const progress = { ...(session.reviewProgress ?? {}) };

  if (step === "lookups") {
    delete progress.lookupsCommittedAt;
    delete progress.cardSetsCommittedAt;
    delete progress.cardsReviewCommittedAt;
  } else if (step === "cardSets") {
    delete progress.cardSetsCommittedAt;
    delete progress.cardsReviewCommittedAt;
  } else {
    delete progress.cardsReviewCommittedAt;
  }

  const hasProgress = Object.values(progress).some((value) => value != null);
  return {
    ...session,
    reviewProgress: hasProgress ? progress : undefined,
  };
}

export function reprocessImportReviewSession(
  session: Dm2ImportSession
): Dm2ImportSession {
  const withLookups = applyResolvedLookupsToRows(session);
  const hintedRows = applyCatalogCardSetHintsToRows(
    withLookups.rows,
    withLookups.catalog
  );
  const rows = applySessionContextToRows(hintedRows, withLookups.sessionContext);
  return rebuildDm2ImportSession({ ...withLookups, rows });
}

function reprocessSessionRows(session: Dm2ImportSession): Dm2ImportSession {
  return reprocessImportReviewSession(session);
}

/** Commit step 1: finalize lookup decisions and reprocess rows for card set review. */
export function commitLookupsReviewStep(
  session: Dm2ImportSession
): Dm2ImportReviewStepCommitResult {
  if (getPendingProposalCount(session) > 0) {
    return {
      error: "Resolve every lookup proposal before committing this step.",
    };
  }

  if (getLookupBlockingIssueCount(session) > 0) {
    return {
      error: "Resolve blocking lookup issues before committing this step.",
    };
  }

  const reprocessed = reprocessSessionRows(session);

  return {
    session: {
      ...reprocessed,
      reviewProgress: {
        lookupsCommittedAt: new Date().toISOString(),
      },
    },
  };
}

/** Commit step 3: final card validation reprocess before database commit. */
export function commitCardsReviewStep(
  session: Dm2ImportSession
): Dm2ImportReviewStepCommitResult {
  if (!session.reviewProgress?.cardSetsCommittedAt) {
    return {
      error: "Commit the card set review step before committing cards.",
    };
  }

  if (getBlockingIssueCount(session) > 0) {
    return {
      error: "Resolve all blocking issues before committing the cards step.",
    };
  }

  if (getDuplicateIssueCount(session) > 0) {
    return {
      error: `Resolve ${getDuplicateIssueCount(session)} duplicate group(s) before committing the cards step.`,
    };
  }

  if (getReadyRowCount(session) === 0) {
    return {
      error: "No cards are ready to import.",
    };
  }

  const reprocessed = reprocessSessionRows(session);

  return {
    session: {
      ...reprocessed,
      reviewProgress: {
        ...session.reviewProgress,
        cardsReviewCommittedAt: new Date().toISOString(),
      },
    },
  };
}
