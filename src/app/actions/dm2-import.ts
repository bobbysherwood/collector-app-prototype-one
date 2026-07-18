"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  extractDm2DataWithAi,
  generateDm2WebSearchQueries,
  inferDm2SpreadsheetMappingWithAi,
  refineDm2ImportWithAi,
} from "@/lib/dm2-import-ai";
import { buildDm2CatalogSummary } from "@/lib/dm2-import-catalog-summary";
import {
  DM2_IMPORT_LARGE_ROW_THRESHOLD,
  DM2_IMPORT_MAX_FILES,
  DM2_IMPORT_MAX_FILE_BYTES,
  DM2_IMPORT_MAX_TOTAL_BYTES,
  DM2_IMPORT_MAX_TOTAL_ROWS,
  buildSpreadsheetSampleContent,
  canUseHeuristicSpreadsheetMapping,
  collectDistinctColumnValues,
  extractFileContent,
  extractRowsFromSpreadsheet,
  applySpreadsheetColumnFixes,
  finalizeCardSetValueSplits,
  inferColumnMappingHeuristic,
  isSpreadsheetFile,
  readSpreadsheetData,
} from "@/lib/dm2-import-file-content";
import { buildDm2ImportSession } from "@/lib/dm2-import-resolve";
import {
  buildCatalogCardSetProfiles,
  getCatalogInsertSetNames,
} from "@/lib/dm2-import-catalog-hints";
import {
  createCommitStatsCollector,
  duplicateEntityLabel,
  hasFixableRowErrors,
  type CommitStatsCollector,
} from "@/lib/dm2-import-commit-stats";
import {
  formatWebResearchForPrompt,
  researchCardSetsOnWeb,
} from "@/lib/dm2-import-web-research";
import {
  getDm2Brands,
  getDm2CardSetCategories,
  getDm2CardSetNames,
  getDm2CardSets,
  getDm2EntityDescriptions,
  getDm2Manufacturers,
  getDm2Parallels,
} from "@/lib/data-model-v2-data";
import { getAdminPickLists } from "@/lib/pick-list-data";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";
import type {
  Dm2ExtractedRow,
  Dm2ImportCatalogContext,
  Dm2ImportCommitResult,
  Dm2ImportFileInput,
  Dm2ImportSession,
  Dm2LookupProposal,
} from "@/types/dm2-import";

async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Unauthorized" as const };
  }
  return { error: null };
}

function revalidateDataModelV2Paths() {
  revalidatePath("/admin");
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

async function loadCatalogContext(): Promise<Dm2ImportCatalogContext> {
  const [
    entityDescriptions,
    pickLists,
    manufacturers,
    brands,
    cardSetCategories,
    cardSetNames,
    parallels,
    cardSets,
  ] = await Promise.all([
    getDm2EntityDescriptions(),
    getAdminPickLists(),
    getDm2Manufacturers(),
    getDm2Brands(),
    getDm2CardSetCategories(),
    getDm2CardSetNames(),
    getDm2Parallels(),
    getDm2CardSets(),
  ]);

  return {
    entityDescriptions: entityDescriptions.map((item) => ({
      entityKey: item.entityKey,
      title: item.title,
      description: item.description,
      tableName: item.tableName,
      sortOrder: item.sortOrder,
    })),
    sports: (pickLists.sport ?? []).map((sport) => ({
      id: sport.id,
      label: sport.label,
      active: sport.active,
    })),
    manufacturers: manufacturers.map((item) => ({
      id: item.id,
      name: item.name,
      active: item.active,
    })),
    brands: brands.map((item) => ({
      id: item.id,
      name: item.name,
      manufacturerId: item.manufacturerId,
      manufacturerName: item.manufacturerName,
      active: item.active,
    })),
    cardSetCategories: cardSetCategories.map((item) => ({
      id: item.id,
      name: item.name,
      active: item.active,
    })),
    cardSetNames: cardSetNames.map((item) => ({
      id: item.id,
      name: item.name,
      active: item.active,
    })),
    parallels: parallels.map((item) => ({
      id: item.id,
      name: item.name,
      active: item.active,
    })),
    cardSets: cardSets.map((item) => ({
      id: item.id,
      sportId: item.sportId,
      year: item.year,
      brandId: item.brandId,
      cardSetCategoryId: item.cardSetCategoryId,
      cardSetNameId: item.cardSetNameId,
    })),
    cardSetProfiles: cardSets.map((item) => ({
      cardSetName: item.cardSetName,
      cardSetCategory: item.cardSetCategoryName,
      sportLabel: item.sportName,
      year: item.year,
      brandName: item.brandName,
      manufacturerName: item.manufacturerName,
    })),
    cards: [],
  };
}

export async function processDm2ImportFiles(
  files: Dm2ImportFileInput[]
): Promise<{ error?: string; session?: Dm2ImportSession }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!files.length) {
    return { error: "Select at least one file to upload." };
  }

  if (files.length > DM2_IMPORT_MAX_FILES) {
    return {
      error: `You can upload up to ${DM2_IMPORT_MAX_FILES} files per session.`,
    };
  }

  let totalBytes = 0;
  for (const file of files) {
    const byteLength = Buffer.from(file.contentBase64, "base64").byteLength;
    if (byteLength > DM2_IMPORT_MAX_FILE_BYTES) {
      return {
        error: `${file.fileName} exceeds the per-file size limit.`,
      };
    }
    totalBytes += byteLength;
  }

  if (totalBytes > DM2_IMPORT_MAX_TOTAL_BYTES) {
    return { error: "Total upload size exceeds the session limit." };
  }

  const catalog = await loadCatalogContext();
  const spreadsheetOnly = files.every((file) =>
    isSpreadsheetFile(file.fileName, file.mimeType)
  );
  const catalogSummary = spreadsheetOnly
    ? ""
    : buildDm2CatalogSummary(catalog);
  const catalogInsertSetNames = getCatalogInsertSetNames(
    buildCatalogCardSetProfiles(catalog)
  );
  const sessionId = randomUUID();
  const fileResults: Dm2ImportSession["files"] = [];
  const contexts: Dm2ImportSession["sessionContext"][] = [];
  const allRows: Dm2ExtractedRow[] = [];
  let model = "gpt-4o-mini";
  let promptVersion = "2.0";
  let researchNotes: Dm2ImportSession["researchNotes"] = [
    {
      id: randomUUID(),
      source: "catalog",
      title: "Catalog context loaded",
      detail:
        "Extraction and refinement used existing Data Model v2 tables for naming patterns and lookup matching.",
    },
  ];

  let webResearchText = spreadsheetOnly
    ? "Public internet research: skipped for checklist spreadsheet import."
    : "Public internet research: skipped.";
  let mappingFramework: Dm2ImportSession["mappingFramework"] = [];
  let suggestions: Dm2ImportSession["suggestions"] = [];

  if (!spreadsheetOnly) {
    const fileNames: string[] = [];
    const contentPreviews: string[] = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(file.contentBase64, "base64");
        const content = await extractFileContent({
          fileName: file.fileName,
          mimeType: file.mimeType,
          buffer: buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
          ),
        });

        fileNames.push(file.fileName);
        contentPreviews.push(content.slice(0, 2_500));
      } catch (error) {
        fileResults.push({
          fileName: file.fileName,
          status: "failed",
          error:
            error instanceof Error ? error.message : "Failed to read file.",
        });
      }
    }

    if (fileNames.length > 0) {
      try {
        const queries = await generateDm2WebSearchQueries({
          fileNames,
          contentPreviews,
        });
        const webResearch = await researchCardSetsOnWeb(queries);
        webResearchText = formatWebResearchForPrompt(webResearch);
        researchNotes = webResearch.flatMap((result) =>
          result.snippets.map((snippet) => ({
            id: randomUUID(),
            source: "web" as const,
            title: snippet.title,
            detail: snippet.snippet,
            url: snippet.url,
          }))
        );
      } catch (error) {
        webResearchText = `Public internet research failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  } else {
    researchNotes = [
      ...researchNotes,
      {
        id: randomUUID(),
        source: "catalog",
        title: "Checklist spreadsheet fast path",
        detail:
          "Standard spreadsheet headers detected — skipped web research and AI column mapping; programmatic CARD SET splits applied.",
      },
    ];
  }

  for (const file of files) {
    if (fileResults.some((result) => result.fileName === file.fileName)) {
      continue;
    }

    try {
      const buffer = Buffer.from(file.contentBase64, "base64");
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );

      if (isSpreadsheetFile(file.fileName, file.mimeType)) {
        const spreadsheetData = readSpreadsheetData(
          arrayBuffer,
          file.fileName,
          file.mimeType
        );
        const heuristicFallback = inferColumnMappingHeuristic(spreadsheetData);
        const sheet =
          spreadsheetData.sheets[
            heuristicFallback?.sheetIndex ?? spreadsheetData.primarySheetIndex
          ];
        const headerRowIndex = heuristicFallback?.headerRowIndex ?? 0;
        const dataStartRowIndex = heuristicFallback?.dataStartRowIndex ?? 1;
        const headerRow = sheet?.rows[headerRowIndex] ?? [];
        const headers = headerRow.map((cell) => String(cell ?? "").trim());
        const useHeuristicMapping = canUseHeuristicSpreadsheetMapping(
          heuristicFallback,
          headers
        );

        let finalizedMapping;
        if (useHeuristicMapping && heuristicFallback) {
          model = "heuristic";
          promptVersion = "2.0";
          finalizedMapping = finalizeCardSetValueSplits({
            data: spreadsheetData,
            mapping: applySpreadsheetColumnFixes(heuristicFallback, headerRow),
            catalogParallels: catalog.parallels.map((parallel) => parallel.name),
            catalogCardSetNames: catalog.cardSetNames.map(
              (setName) => setName.name
            ),
            catalogInsertSetNames,
          });
        } else {
          const sampleContent = buildSpreadsheetSampleContent(spreadsheetData);
          const cardSetColumnIndex = headers.findIndex(
            (header) => header.toLowerCase() === "card set"
          );
          const distinctCardSetColumnIndex =
            cardSetColumnIndex >= 0
              ? cardSetColumnIndex
              : heuristicFallback?.columns.cardSetName;
          const programColumnIndex = headers.findIndex(
            (header) => header.toLowerCase() === "program"
          );

          const mapped = await inferDm2SpreadsheetMappingWithAi({
            fileName: file.fileName,
            sheetNames: spreadsheetData.sheets.map((sheet) => sheet.name),
            sampleContent,
            headers,
            distinctCardSetValues: collectDistinctColumnValues({
              data: spreadsheetData,
              sheetIndex:
                heuristicFallback?.sheetIndex ?? spreadsheetData.primarySheetIndex,
              headerRowIndex,
              dataStartRowIndex,
              columnIndex: distinctCardSetColumnIndex,
            }),
            distinctProgramValues: collectDistinctColumnValues({
              data: spreadsheetData,
              sheetIndex:
                heuristicFallback?.sheetIndex ?? spreadsheetData.primarySheetIndex,
              headerRowIndex,
              dataStartRowIndex,
              columnIndex:
                programColumnIndex >= 0 ? programColumnIndex : undefined,
            }),
            catalogParallels: catalog.parallels.map((parallel) => parallel.name),
            catalogCardSetNames: catalog.cardSetNames.map(
              (setName) => setName.name
            ),
            catalogInsertSetNames,
            catalogSummary,
            webResearch: webResearchText,
            heuristicFallback,
          });

          model = mapped.model;
          promptVersion = mapped.promptVersion;

          finalizedMapping = finalizeCardSetValueSplits({
            data: spreadsheetData,
            mapping: applySpreadsheetColumnFixes(
              mapped.mapping,
              headerRow
            ),
            catalogParallels: catalog.parallels.map((parallel) => parallel.name),
            catalogCardSetNames: catalog.cardSetNames.map(
              (setName) => setName.name
            ),
            catalogInsertSetNames,
          });
        }

        const { rows: rawRows, sessionContext } = extractRowsFromSpreadsheet({
          data: spreadsheetData,
          mapping: finalizedMapping,
          fileName: file.fileName,
          catalog,
        });

        const rowsWithIds: Dm2ExtractedRow[] = rawRows.map((row) => ({
          ...row,
          id: randomUUID(),
        }));

        contexts.push(sessionContext);
        allRows.push(...rowsWithIds);

        fileResults.push({
          fileName: file.fileName,
          status: "success",
          rowCount: rowsWithIds.length,
        });
        continue;
      }

      const content = await extractFileContent({
        fileName: file.fileName,
        mimeType: file.mimeType,
        buffer: arrayBuffer,
      });

      const extracted = await extractDm2DataWithAi({
        fileName: file.fileName,
        mimeType: file.mimeType,
        content,
        catalogSummary,
        webResearch: webResearchText,
      });

      model = extracted.model;
      promptVersion = extracted.promptVersion;
      contexts.push(extracted.sessionContext);
      allRows.push(...extracted.rows);

      fileResults.push({
        fileName: file.fileName,
        status: "success",
        rowCount: extracted.rows.length,
      });
    } catch (error) {
      fileResults.push({
        fileName: file.fileName,
        status: "failed",
        error:
          error instanceof Error ? error.message : "Failed to process file.",
      });
    }
  }

  if (allRows.length === 0) {
    const failed = fileResults.filter((file) => file.status === "failed");
    const failureDetails =
      failed.length > 0
        ? failed
            .map((file) => `${file.fileName}: ${file.error ?? "Unknown error"}`)
            .join(" ")
        : null;
    return {
      error:
        failureDetails ??
        "No card rows were found in the uploaded files.",
      session: buildDm2ImportSession({
        id: sessionId,
        files: fileResults,
        contexts,
        rows: [],
        model,
        promptVersion,
        catalog,
        suggestions,
        researchNotes,
        mappingFramework,
      }),
    };
  }

  if (allRows.length > DM2_IMPORT_MAX_TOTAL_ROWS) {
    return {
      error: `Total rows (${allRows.length}) exceed the ${DM2_IMPORT_MAX_TOTAL_ROWS} row limit.`,
    };
  }

  let refinedContext = mergeContexts(contexts);
  let refinedRows = allRows;

  if (allRows.length <= DM2_IMPORT_LARGE_ROW_THRESHOLD) {
    try {
      const refined = await refineDm2ImportWithAi({
        fileNames: fileResults
          .filter((file) => file.status === "success")
          .map((file) => file.fileName),
        sessionContext: refinedContext,
        rows: allRows,
        catalogSummary,
        webResearch: webResearchText,
      });

      refinedContext = refined.sessionContext;
      refinedRows = refined.rows;
      suggestions = refined.suggestions;
      mappingFramework = refined.mappingFramework;
      researchNotes = [...researchNotes, ...refined.researchNotes];
    } catch (error) {
      researchNotes = [
        ...researchNotes,
        {
          id: randomUUID(),
          source: "catalog",
          title: "Refinement skipped",
          detail:
            error instanceof Error
              ? error.message
              : "Could not run catalog/web refinement pass.",
        },
      ];
    }
  } else {
    researchNotes = [
      ...researchNotes,
      {
        id: randomUUID(),
        source: "catalog",
        title: "Large import — refinement skipped",
        detail: `${allRows.length.toLocaleString()} rows extracted programmatically. Review lookup proposals and row defaults before committing.`,
      },
    ];
  }

  const session = buildDm2ImportSession({
    id: sessionId,
    files: fileResults,
    contexts,
    sessionContext: refinedContext,
    rows: refinedRows,
    model,
    promptVersion,
    catalog,
    suggestions,
    researchNotes,
    mappingFramework,
  });

  return { session };
}

function mergeContexts(
  contexts: Dm2ImportSession["sessionContext"][]
): Dm2ImportSession["sessionContext"] {
  const merged: Dm2ImportSession["sessionContext"] = {};
  const fields: Array<keyof Dm2ImportSession["sessionContext"]> = [
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
      if (value != null && value !== "") values.add(value);
    }
    if (values.size === 1) {
      merged[field] = [...values][0] as never;
    }
  }

  return merged;
}

function proposalKey(proposal: Dm2LookupProposal): string {
  return proposal.normalizedKey;
}

const LOOKUP_CREATE_ORDER: Dm2LookupProposal["entityType"][] = [
  "sport",
  "manufacturer",
  "brand",
  "cardSetCategory",
  "cardSetName",
  "parallel",
];

function sortProposalsForCommit(
  proposals: Dm2LookupProposal[]
): Dm2LookupProposal[] {
  return [...proposals].sort(
    (a, b) =>
      LOOKUP_CREATE_ORDER.indexOf(a.entityType) -
      LOOKUP_CREATE_ORDER.indexOf(b.entityType)
  );
}

function manufacturerNameCandidates(
  proposal: Dm2LookupProposal
): string[] {
  const names = [proposal.proposedName];
  if (proposal.action === "use_existing" && proposal.matchName) {
    names.push(proposal.matchName);
  }
  return names.map((name) => normalizeKey(name));
}

function findManufacturerProposal(
  session: Dm2ImportSession,
  brandProposal: Dm2LookupProposal
): Dm2LookupProposal | undefined {
  const targetNames = new Set<string>();
  if (brandProposal.manufacturerName) {
    targetNames.add(normalizeKey(brandProposal.manufacturerName));
  }
  if (session.sessionContext.manufacturer) {
    targetNames.add(normalizeKey(session.sessionContext.manufacturer));
  }

  if (targetNames.size === 0) return undefined;

  return session.proposals.find(
    (item) =>
      item.entityType === "manufacturer" &&
      manufacturerNameCandidates(item).some((name) => targetNames.has(name))
  );
}

function resolveProposalId(
  proposal: Dm2LookupProposal,
  resolved: Map<string, string>
): string | undefined {
  if (proposal.action === "use_existing" && proposal.matchId) {
    return proposal.matchId;
  }
  return resolved.get(proposalKey(proposal));
}

function proposalNameCandidates(proposal: Dm2LookupProposal): string[] {
  const names = [proposal.proposedName];
  if (proposal.matchName) names.push(proposal.matchName);
  return [...new Set(names.map((name) => normalizeKey(name)))];
}

function findProposalForCommit(
  session: Dm2ImportSession,
  entityType: Dm2LookupProposal["entityType"],
  name: string | undefined,
  manufacturerName?: string
): Dm2LookupProposal | undefined {
  if (!name?.trim()) return undefined;

  const normalized = normalizeKey(name);
  return session.proposals.find((proposal) => {
    if (proposal.entityType !== entityType) return false;
    if (entityType === "brand" && manufacturerName && proposal.manufacturerName) {
      if (
        normalizeKey(proposal.manufacturerName) !== normalizeKey(manufacturerName)
      ) {
        return false;
      }
    }
    return proposalNameCandidates(proposal).includes(normalized);
  });
}

const CARD_INSERT_BATCH_SIZE = 1000;
const CARD_INSERT_CONCURRENCY = 4;
const NULL_PARALLEL_UUID = "00000000-0000-0000-0000-000000000000";
const EXISTING_CARD_KEY_PAGE_SIZE = 1000;
const CARD_SET_ID_IN_CHUNK_SIZE = 20;

function proposalIndexKey(
  entityType: Dm2LookupProposal["entityType"],
  normalizedName: string,
  manufacturerName?: string
): string {
  if (entityType === "brand" && manufacturerName) {
    return `brand|${normalizeKey(manufacturerName)}|${normalizedName}`;
  }
  return `${entityType}|${normalizedName}`;
}

function buildCommitProposalIndex(
  proposals: Dm2LookupProposal[]
): Map<string, Dm2LookupProposal> {
  const index = new Map<string, Dm2LookupProposal>();

  for (const proposal of proposals) {
    for (const name of proposalNameCandidates(proposal)) {
      const key = proposalIndexKey(
        proposal.entityType,
        name,
        proposal.entityType === "brand" ? proposal.manufacturerName : undefined
      );
      if (!index.has(key)) {
        index.set(key, proposal);
      }
    }
  }

  return index;
}

function findProposalForCommitIndexed(
  index: Map<string, Dm2LookupProposal>,
  entityType: Dm2LookupProposal["entityType"],
  name: string | undefined,
  manufacturerName?: string
): Dm2LookupProposal | undefined {
  if (!name?.trim()) return undefined;

  const normalized = normalizeKey(name);
  return index.get(
    proposalIndexKey(entityType, normalized, manufacturerName)
  );
}

function cardInsertIdentityKey(insert: {
  card_set_id: string;
  card_number: string;
  player: string;
  parallel_id: string | null;
}): string {
  return [
    insert.card_set_id,
    insert.card_number.trim().toLowerCase(),
    insert.player.trim().toLowerCase(),
    insert.parallel_id ?? NULL_PARALLEL_UUID,
  ].join("|");
}

async function loadExistingCardIdentityKeys(
  supabase: Awaited<
    ReturnType<(typeof import("@/lib/supabase/server"))["createClient"]>
  >,
  cardSetIds: string[]
): Promise<Set<string>> {
  const keys = new Set<string>();
  const uniqueIds = [...new Set(cardSetIds)];
  if (uniqueIds.length === 0) return keys;

  for (let i = 0; i < uniqueIds.length; i += CARD_SET_ID_IN_CHUNK_SIZE) {
    const idChunk = uniqueIds.slice(i, i + CARD_SET_ID_IN_CHUNK_SIZE);
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("dm2_cards")
        .select("card_set_id, card_number, player, parallel_id")
        .in("card_set_id", idChunk)
        .range(offset, offset + EXISTING_CARD_KEY_PAGE_SIZE - 1);

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.length) break;

      for (const row of data) {
        keys.add(cardInsertIdentityKey(row));
      }

      if (data.length < EXISTING_CARD_KEY_PAGE_SIZE) break;
      offset += EXISTING_CARD_KEY_PAGE_SIZE;
    }
  }

  return keys;
}

function partitionNewCardInserts(
  rows: PendingCardInsert[],
  existingKeys: Set<string>,
  stats: CommitStatsCollector
): PendingCardInsert[] {
  const pending: PendingCardInsert[] = [];

  for (const row of rows) {
    const key = cardInsertIdentityKey(row.insert);
    if (existingKeys.has(key)) {
      stats.incrementCardsSkipped();
      stats.pushDuplicate({
        entityType: "card",
        label: cardDuplicateLabel(row.meta),
        detail: "Already exists in the database",
        rowId: row.meta.rowId,
        sourceFileName: row.meta.sourceFileName,
      });
      continue;
    }

    existingKeys.add(key);
    pending.push(row);
  }

  return pending;
}

type CardInsertRow = {
  card_set_id: string;
  card_number: string;
  player: string;
  parallel_id: string | null;
  active: boolean;
};

type PendingCardInsert = {
  insert: CardInsertRow;
  meta: {
    rowId: string;
    sourceFileName: string;
    sourceRowIndex: number;
    cardNumber: string;
    player: string;
    cardSetName?: string;
    parallel?: string;
  };
};

function cardDuplicateLabel(meta: PendingCardInsert["meta"]): string {
  const parts = [
    meta.cardNumber ? `#${meta.cardNumber}` : null,
    meta.player,
    meta.cardSetName,
    meta.parallel ? `(${meta.parallel})` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Card";
}

async function insertCardBatch(
  supabase: Awaited<
    ReturnType<(typeof import("@/lib/supabase/server"))["createClient"]>
  >,
  rows: PendingCardInsert[],
  stats: CommitStatsCollector
): Promise<{ error?: string }> {
  if (rows.length === 0) return {};

  const payload = rows.map((row) => row.insert);
  const { error } = await supabase.from("dm2_cards").insert(payload);
  if (!error) {
    stats.added.cards += rows.length;
    return {};
  }

  if (error.code === "23505" && rows.length > 1) {
    const mid = Math.floor(rows.length / 2);
    const first = await insertCardBatch(supabase, rows.slice(0, mid), stats);
    if (first.error) return first;
    return insertCardBatch(supabase, rows.slice(mid), stats);
  }

  if (error.code === "23505" && rows.length === 1) {
    stats.incrementCardsSkipped();
    stats.pushDuplicate({
      entityType: "card",
      label: cardDuplicateLabel(rows[0].meta),
      detail: "Already exists in the database",
      rowId: rows[0].meta.rowId,
      sourceFileName: rows[0].meta.sourceFileName,
    });
    return {};
  }

  stats.pushError({
    code: "batch_insert_failed",
    message: error.message,
  });

  return { error: error.message };
}

async function insertCardBatchesConcurrent(
  supabase: Awaited<
    ReturnType<(typeof import("@/lib/supabase/server"))["createClient"]>
  >,
  rows: PendingCardInsert[],
  stats: CommitStatsCollector
): Promise<{ error?: string }> {
  if (rows.length === 0) return {};

  const batches: PendingCardInsert[][] = [];
  for (let index = 0; index < rows.length; index += CARD_INSERT_BATCH_SIZE) {
    batches.push(rows.slice(index, index + CARD_INSERT_BATCH_SIZE));
  }

  for (let index = 0; index < batches.length; index += CARD_INSERT_CONCURRENCY) {
    const wave = batches.slice(index, index + CARD_INSERT_CONCURRENCY);
    const results = await Promise.all(
      wave.map((batch) => insertCardBatch(supabase, batch, stats))
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      return failed;
    }
  }

  return {};
}

export async function commitDm2ImportSession(
  session: Dm2ImportSession
): Promise<Dm2ImportCommitResult> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const blockingIssues = session.issues.filter(
    (issue) => issue.severity === "blocking"
  );
  const unresolvedProposals = session.proposals.filter(
    (proposal) => proposal.action === "pending" && !proposal.matchId
  );

  if (blockingIssues.length > 0 || unresolvedProposals.length > 0) {
    const stats = createCommitStatsCollector();
    const message =
      "Resolve all blocking issues and lookup proposals before committing.";
    stats.pushError({
      code: "pre_commit_validation",
      message: `${blockingIssues.length} blocking issue(s) and ${unresolvedProposals.length} unresolved proposal(s) remain.`,
    });
    return stats.toResult({ error: message });
  }

  const stats = createCommitStatsCollector();

  const createLookup = async (
    table:
      | "dm2_manufacturers"
      | "dm2_card_set_categories"
      | "dm2_card_set_names"
      | "dm2_parallels",
    name: string,
    entityType:
      | "manufacturer"
      | "cardSetCategory"
      | "cardSetName"
      | "parallel",
    addedKey: "manufacturers" | "cardSetCategories" | "cardSetNames" | "parallels"
  ): Promise<string | null> => {
    const { data, error } = await supabase
      .from(table)
      .insert({ name: name.trim(), active: true })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase
          .from(table)
          .select("id")
          .ilike("name", name.trim())
          .maybeSingle();
        if (existing?.id) {
          stats.pushDuplicate({
            entityType,
            label: duplicateEntityLabel(entityType, name.trim()),
            detail: "Reused existing catalog entry",
          });
          return existing.id;
        }
      }
      stats.pushError({
        code: "lookup_create_failed",
        message: `Failed to create ${entityType} "${name.trim()}": ${error.message}`,
      });
      return null;
    }

    stats.added[addedKey] += 1;
    return data.id as string;
  };

  const resolvedIds = new Map<string, string>();
  const pickLists = await getAdminPickLists();
  const maxSortOrder =
    (pickLists.sport ?? []).reduce(
      (max, sport) => Math.max(max, sport.sortOrder ?? 0),
      0
    ) ?? 0;
  let nextSortOrder = maxSortOrder;

  for (const proposal of sortProposalsForCommit(session.proposals)) {
    if (proposal.action === "use_existing" && proposal.matchId) {
      resolvedIds.set(proposalKey(proposal), proposal.matchId);
      continue;
    }

    if (proposal.action !== "create_new") continue;

    if (proposal.entityType === "sport") {
      nextSortOrder += 1;
      const { data, error } = await supabase
        .from("pick_list_options")
        .insert({
          category: "sport",
          label: proposal.proposedName.trim(),
          sort_order: nextSortOrder,
          active: true,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("pick_list_options")
            .select("id")
            .eq("category", "sport")
            .ilike("label", proposal.proposedName.trim())
            .maybeSingle();
          if (existing?.id) {
            stats.pushDuplicate({
              entityType: "sport",
              label: duplicateEntityLabel("sport", proposal.proposedName.trim()),
              detail: "Reused existing catalog entry",
            });
            resolvedIds.set(proposalKey(proposal), existing.id);
            continue;
          }
        }
        stats.pushError({
          code: "lookup_create_failed",
          message: `Failed to create sport "${proposal.proposedName.trim()}": ${error.message}`,
        });
        return stats.toResult({ error: error.message });
      }

      stats.added.sports += 1;
      resolvedIds.set(proposalKey(proposal), data.id);
      continue;
    }

    if (proposal.entityType === "manufacturer") {
      const id = await createLookup(
        "dm2_manufacturers",
        proposal.proposedName,
        "manufacturer",
        "manufacturers"
      );
      if (!id) {
        return stats.toResult({
          error: `Failed to create manufacturer "${proposal.proposedName}".`,
        });
      }
      resolvedIds.set(proposalKey(proposal), id);
      continue;
    }

    if (proposal.entityType === "cardSetCategory") {
      const id = await createLookup(
        "dm2_card_set_categories",
        proposal.proposedName,
        "cardSetCategory",
        "cardSetCategories"
      );
      if (!id) {
        return stats.toResult({
          error: `Failed to create category "${proposal.proposedName}".`,
        });
      }
      resolvedIds.set(proposalKey(proposal), id);
      continue;
    }

    if (proposal.entityType === "cardSetName") {
      const id = await createLookup(
        "dm2_card_set_names",
        proposal.proposedName,
        "cardSetName",
        "cardSetNames"
      );
      if (!id) {
        return stats.toResult({
          error: `Failed to create set name "${proposal.proposedName}".`,
        });
      }
      resolvedIds.set(proposalKey(proposal), id);
      continue;
    }

    if (proposal.entityType === "parallel") {
      const id = await createLookup(
        "dm2_parallels",
        proposal.proposedName,
        "parallel",
        "parallels"
      );
      if (!id) {
        return stats.toResult({
          error: `Failed to create parallel "${proposal.proposedName}".`,
        });
      }
      resolvedIds.set(proposalKey(proposal), id);
      continue;
    }

    if (proposal.entityType === "brand") {
      const manufacturerProposal = findManufacturerProposal(session, proposal);
      const manufacturerId = manufacturerProposal
        ? resolveProposalId(manufacturerProposal, resolvedIds)
        : undefined;

      if (!manufacturerId) {
        const manufacturerLabel =
          proposal.manufacturerName ??
          session.sessionContext.manufacturer ??
          "unknown";
        const message = `Cannot create brand "${proposal.proposedName}" without a resolved manufacturer (${manufacturerLabel}).`;
        stats.pushError({
          code: "brand_without_manufacturer",
          message,
        });
        return stats.toResult({ error: message });
      }

      const { data, error } = await supabase
        .from("dm2_brands")
        .insert({
          name: proposal.proposedName.trim(),
          manufacturer_id: manufacturerId,
          active: true,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("dm2_brands")
            .select("id")
            .eq("manufacturer_id", manufacturerId)
            .ilike("name", proposal.proposedName.trim())
            .maybeSingle();
          if (existing?.id) {
            stats.pushDuplicate({
              entityType: "brand",
              label: duplicateEntityLabel("brand", proposal.proposedName.trim()),
              detail: "Reused existing catalog entry",
            });
            resolvedIds.set(proposalKey(proposal), existing.id);
            continue;
          }
        }
        stats.pushError({
          code: "lookup_create_failed",
          message: `Failed to create brand "${proposal.proposedName.trim()}": ${error.message}`,
        });
        return stats.toResult({ error: error.message });
      }

      stats.added.brands += 1;
      resolvedIds.set(proposalKey(proposal), data.id);
    }
  }

  for (const proposal of session.proposals) {
    if (!resolvedIds.has(proposalKey(proposal)) && proposal.matchId) {
      resolvedIds.set(proposalKey(proposal), proposal.matchId);
    }
  }

  const cardSetIds = new Map<string, string>();
  const reusedCardSetKeys = new Set<string>();

  const activeRows = session.rows.filter((row) => !row.excluded);
  const pendingCardInserts: PendingCardInsert[] = [];
  const proposalIndex = buildCommitProposalIndex(session.proposals);

  for (const row of activeRows) {
    const sportProposal = findProposalForCommitIndexed(
      proposalIndex,
      "sport",
      row.sport
    );
    const brandProposal = findProposalForCommitIndexed(
      proposalIndex,
      "brand",
      row.brand,
      row.manufacturer
    );
    const categoryProposal = findProposalForCommitIndexed(
      proposalIndex,
      "cardSetCategory",
      row.cardSetCategory
    );
    const setNameProposal = findProposalForCommitIndexed(
      proposalIndex,
      "cardSetName",
      row.cardSetName
    );

    const sportId = sportProposal
      ? resolveProposalId(sportProposal, resolvedIds)
      : undefined;
    const brandId = brandProposal
      ? resolveProposalId(brandProposal, resolvedIds)
      : undefined;
    const cardSetCategoryId = categoryProposal
      ? resolveProposalId(categoryProposal, resolvedIds)
      : undefined;
    const cardSetNameId = setNameProposal
      ? resolveProposalId(setNameProposal, resolvedIds)
      : undefined;

    if (
      !sportId ||
      !row.year ||
      !brandId ||
      !cardSetCategoryId ||
      !cardSetNameId ||
      !row.cardNumber?.trim() ||
      !row.player?.trim()
    ) {
      const missingFields: string[] = [];
      if (!sportId) missingFields.push("sport");
      if (!row.year) missingFields.push("year");
      if (!brandId) missingFields.push("brand");
      if (!cardSetCategoryId) missingFields.push("card set category");
      if (!cardSetNameId) missingFields.push("card set name");
      if (!row.cardNumber?.trim()) missingFields.push("card #");
      if (!row.player?.trim()) missingFields.push("player");

      stats.incrementCardsFailed();
      stats.pushError({
        code: "row_incomplete",
        message: `Missing required fields: ${missingFields.join(", ")}`,
        rowId: row.id,
        sourceFileName: row.sourceFileName,
        sourceRowIndex: row.sourceRowIndex,
        cardNumber: row.cardNumber,
        player: row.player,
        cardSetName: row.cardSetName,
      });
      continue;
    }

    const cardSetKey = [
      sportId,
      row.year,
      brandId,
      cardSetCategoryId,
      cardSetNameId,
    ].join(":");

    let cardSetId = cardSetIds.get(cardSetKey);
    if (!cardSetId) {
      const { data: existingCardSet } = await supabase
        .from("dm2_card_sets")
        .select("id")
        .eq("sport_id", sportId)
        .eq("year", row.year)
        .eq("brand_id", brandId)
        .eq("card_set_category_id", cardSetCategoryId)
        .eq("card_set_name_id", cardSetNameId)
        .maybeSingle();

      if (existingCardSet?.id) {
        cardSetId = existingCardSet.id;
        if (!reusedCardSetKeys.has(cardSetKey)) {
          reusedCardSetKeys.add(cardSetKey);
          stats.pushDuplicate({
            entityType: "cardSet",
            label: duplicateEntityLabel(
              "cardSet",
              `${row.year} ${row.brand ?? ""} ${row.cardSetName ?? ""}`.trim()
            ),
            detail: "Existing card set reused",
          });
        }
      } else {
        const { data, error } = await supabase
          .from("dm2_card_sets")
          .insert({
            sport_id: sportId,
            year: row.year,
            brand_id: brandId,
            card_set_category_id: cardSetCategoryId,
            card_set_name_id: cardSetNameId,
            active: true,
          })
          .select("id")
          .single();

        if (error) {
          if (error.code === "23505") {
            const { data: raced } = await supabase
              .from("dm2_card_sets")
              .select("id")
              .eq("sport_id", sportId)
              .eq("year", row.year)
              .eq("brand_id", brandId)
              .eq("card_set_category_id", cardSetCategoryId)
              .eq("card_set_name_id", cardSetNameId)
              .maybeSingle();
            cardSetId = raced?.id;
            if (cardSetId && !reusedCardSetKeys.has(cardSetKey)) {
              reusedCardSetKeys.add(cardSetKey);
              stats.pushDuplicate({
                entityType: "cardSet",
                label: duplicateEntityLabel(
                  "cardSet",
                  `${row.year} ${row.brand ?? ""} ${row.cardSetName ?? ""}`.trim()
                ),
                detail: "Existing card set reused",
              });
            }
          } else {
            stats.pushError({
              code: "card_set_create_failed",
              message: `Failed to create card set: ${error.message}`,
              rowId: row.id,
              sourceFileName: row.sourceFileName,
              sourceRowIndex: row.sourceRowIndex,
              cardSetName: row.cardSetName,
            });
            return stats.toResult({ error: error.message });
          }
        } else {
          cardSetId = data.id;
          stats.added.cardSets += 1;
        }
      }

      if (cardSetId) {
        cardSetIds.set(cardSetKey, cardSetId);
      }
    }

    if (!cardSetId) {
      stats.incrementCardsFailed();
      stats.pushError({
        code: "card_set_unresolved",
        message: "Could not create or find card set for this row",
        rowId: row.id,
        sourceFileName: row.sourceFileName,
        sourceRowIndex: row.sourceRowIndex,
        cardNumber: row.cardNumber,
        player: row.player,
        cardSetName: row.cardSetName,
      });
      continue;
    }

    let parallelId: string | null = null;
    if (row.parallel) {
      const parallelProposal = findProposalForCommitIndexed(
        proposalIndex,
        "parallel",
        row.parallel
      );
      parallelId = parallelProposal
        ? resolveProposalId(parallelProposal, resolvedIds) ?? null
        : null;
    }

    pendingCardInserts.push({
      insert: {
        card_set_id: cardSetId,
        card_number: row.cardNumber.trim(),
        player: row.player.trim(),
        parallel_id: parallelId,
        active: true,
      },
      meta: {
        rowId: row.id,
        sourceFileName: row.sourceFileName,
        sourceRowIndex: row.sourceRowIndex,
        cardNumber: row.cardNumber.trim(),
        player: row.player.trim(),
        cardSetName: row.cardSetName,
        parallel: row.parallel,
      },
    });
  }

  let newCardInserts = pendingCardInserts;
  try {
    const existingKeys = await loadExistingCardIdentityKeys(
      supabase,
      pendingCardInserts.map((row) => row.insert.card_set_id)
    );
    newCardInserts = partitionNewCardInserts(
      pendingCardInserts,
      existingKeys,
      stats
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load existing cards";
    stats.pushError({
      code: "batch_insert_failed",
      message,
    });
    return stats.toResult({ error: message });
  }

  const batchResult = await insertCardBatchesConcurrent(
    supabase,
    newCardInserts,
    stats
  );
  if (batchResult.error) {
    return stats.toResult({ error: batchResult.error });
  }

  revalidateDataModelV2Paths();

  const expectedCards = pendingCardInserts.length;
  const savedCards = stats.added.cards + stats.cardsSkipped;
  const warningParts: string[] = [];

  if (stats.cardsFailed > 0) {
    warningParts.push(
      `${stats.cardsFailed} card row(s) could not be matched to resolved lookups and were not saved`
    );
  }
  if (savedCards < expectedCards) {
    warningParts.push(
      `expected ${expectedCards} inserts but saved ${stats.added.cards} (${stats.cardsSkipped} duplicates skipped)`
    );
    stats.pushError({
      code: "unexpected_shortfall",
      message: warningParts[warningParts.length - 1],
    });
  }

  const result = stats.toResult({
    warning: warningParts.length > 0 ? warningParts.join(". ") : undefined,
    canReturnToReview: hasFixableRowErrors(stats.toResult()),
  });

  return result;
}
