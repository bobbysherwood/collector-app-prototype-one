import OpenAI from "openai";
import { randomUUID } from "crypto";
import {
  DM2_IMPORT_PROMPT_VERSION,
  DM2_IMPORT_QUERY_SYSTEM_PROMPT,
  DM2_IMPORT_REFINE_SYSTEM_PROMPT,
  DM2_IMPORT_SPREADSHEET_MAPPING_PROMPT,
  DM2_IMPORT_SYSTEM_PROMPT,
  buildDm2ImportQueryUserMessage,
  buildDm2ImportRefineUserMessage,
  buildDm2ImportUserMessage,
  buildDm2SpreadsheetMappingUserMessage,
} from "@/lib/dm2-import-prompt";
import { capDistinctValuesForAi } from "@/lib/dm2-import-file-content";
import { DM2_EXISTING_VALUE_MATCH_THRESHOLD } from "@/lib/dm2-import-resolve";
import type {
  Dm2ColumnMapping,
  Dm2ExtractedRow,
  Dm2FieldSuggestion,
  Dm2ImportResearchNote,
  Dm2ImportSessionContext,
  Dm2MappingFrameworkNote,
  Dm2SuggestionField,
} from "@/types/dm2-import";

const MODEL = "gpt-4o-mini";

interface AiExtractionResult {
  sessionContext: Dm2ImportSessionContext;
  rows: Dm2ExtractedRow[];
  unsupportedFieldsDetected: string[];
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return new OpenAI({ apiKey });
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asYear(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value >= 1800 && value <= 2100) return value;
  }
  if (typeof value === "string" && value.trim()) {
    const year = Number(value.trim());
    if (Number.isInteger(year) && year >= 1800 && year <= 2100) return year;
  }
  return undefined;
}

function asConfidence(value: unknown): number {
  if (typeof value === "number" && value >= 0 && value <= 1) return value;
  return 0.5;
}

function isSuggestionField(value: unknown): value is Dm2SuggestionField {
  return (
    value === "sport" ||
    value === "year" ||
    value === "manufacturer" ||
    value === "brand" ||
    value === "cardSetCategory" ||
    value === "cardSetName" ||
    value === "cardNumber" ||
    value === "player" ||
    value === "parallel"
  );
}

function parseExtractionResponse(
  content: string,
  fileName: string
): AiExtractionResult {
  const parsed = JSON.parse(content) as {
    sessionContext?: Record<string, unknown>;
    rows?: Array<Record<string, unknown>>;
    unsupportedFieldsDetected?: string[];
  };

  const sessionContext: Dm2ImportSessionContext = {
    sport: asString(parsed.sessionContext?.sport),
    year: asYear(parsed.sessionContext?.year),
    manufacturer: asString(parsed.sessionContext?.manufacturer),
    brand: asString(parsed.sessionContext?.brand),
    cardSetCategory: asString(parsed.sessionContext?.cardSetCategory),
    cardSetName: asString(parsed.sessionContext?.cardSetName),
  };

  const rows: Dm2ExtractedRow[] = (parsed.rows ?? [])
    .map((row, index) => {
      const unsupported = row.unsupportedFields;
      const unsupportedFields =
        unsupported && typeof unsupported === "object"
          ? Object.fromEntries(
              Object.entries(unsupported).filter(
                ([, value]) => typeof value === "string" && value.trim().length > 0
              )
            )
          : undefined;

      return {
        id: randomUUID(),
        sourceFileName: fileName,
        sourceRowIndex:
          typeof row.sourceRowIndex === "number"
            ? row.sourceRowIndex
            : index + 1,
        sport: asString(row.sport),
        year: asYear(row.year),
        manufacturer: asString(row.manufacturer),
        brand: asString(row.brand),
        cardSetCategory: asString(row.cardSetCategory),
        cardSetName: asString(row.cardSetName),
        cardNumber: asString(row.cardNumber),
        player: asString(row.player),
        parallel: asString(row.parallel),
        confidence: asConfidence(row.confidence),
        unsupportedFields:
          unsupportedFields && Object.keys(unsupportedFields).length > 0
            ? unsupportedFields
            : undefined,
        excluded: false,
      };
    })
    .filter(
      (row) =>
        row.cardNumber ||
        row.player ||
        row.manufacturer ||
        row.brand ||
        row.cardSetName
    );

  const unsupportedFieldsDetected = (parsed.unsupportedFieldsDetected ?? [])
    .filter(
      (field): field is string =>
        typeof field === "string" && field.trim().length > 0
    )
    .map((field) => field.trim());

  return { sessionContext, rows, unsupportedFieldsDetected };
}

function parseColumnIndex(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  return undefined;
}

function parseSpreadsheetMappingResponse(
  content: string,
  fallback: Dm2ColumnMapping | null
): {
  mapping: Dm2ColumnMapping;
  unsupportedFieldsDetected: string[];
} {
  const parsed = JSON.parse(content) as {
    sheetIndex?: number;
    headerRowIndex?: number;
    dataStartRowIndex?: number;
    columns?: Record<string, unknown>;
    defaultMetadata?: Record<string, unknown>;
    confidence?: number;
    unsupportedFieldsDetected?: string[];
    combinedCardSetColumn?: number;
    cardSetValueSplits?: Record<
      string,
      {
        cardSetName?: string;
        parallel?: string | null;
        cardSetCategory?: string | null;
      }
    >;
  };

  const columns = parsed.columns ?? {};
  const mapping: Dm2ColumnMapping = {
    sheetIndex:
      typeof parsed.sheetIndex === "number" ? parsed.sheetIndex : fallback?.sheetIndex ?? 0,
    headerRowIndex:
      typeof parsed.headerRowIndex === "number"
        ? parsed.headerRowIndex
        : fallback?.headerRowIndex ?? 0,
    dataStartRowIndex:
      typeof parsed.dataStartRowIndex === "number"
        ? parsed.dataStartRowIndex
        : fallback?.dataStartRowIndex ?? 1,
    columns: {
      sport: parseColumnIndex(columns.sport) ?? fallback?.columns.sport,
      year: parseColumnIndex(columns.year) ?? fallback?.columns.year,
      manufacturer:
        parseColumnIndex(columns.manufacturer) ?? fallback?.columns.manufacturer,
      brand: parseColumnIndex(columns.brand) ?? fallback?.columns.brand,
      cardSetCategory:
        parseColumnIndex(columns.cardSetCategory) ??
        fallback?.columns.cardSetCategory,
      cardSetName:
        parseColumnIndex(columns.cardSetName) ?? fallback?.columns.cardSetName,
      cardNumber:
        parseColumnIndex(columns.cardNumber) ?? fallback?.columns.cardNumber,
      player: parseColumnIndex(columns.player) ?? fallback?.columns.player,
      parallel:
        parseColumnIndex(columns.parallel) ?? fallback?.columns.parallel,
    },
    defaultMetadata: {
      sport: asString(parsed.defaultMetadata?.sport),
      year: asYear(parsed.defaultMetadata?.year),
      manufacturer: asString(parsed.defaultMetadata?.manufacturer),
      brand: asString(parsed.defaultMetadata?.brand),
      cardSetCategory: asString(parsed.defaultMetadata?.cardSetCategory),
      cardSetName: asString(parsed.defaultMetadata?.cardSetName),
    },
    confidence: asConfidence(parsed.confidence ?? fallback?.confidence),
    combinedCardSetColumn:
      typeof parsed.combinedCardSetColumn === "number"
        ? parsed.combinedCardSetColumn
        : fallback?.combinedCardSetColumn,
    cardSetValueSplits: Object.fromEntries(
      Object.entries(parsed.cardSetValueSplits ?? {}).flatMap(([rawValue, split]) => {
        const cardSetName = asString(split?.cardSetName);
        if (!cardSetName) return [];
        return [
          [
            rawValue,
            {
              cardSetName,
              parallel: asString(split?.parallel) ?? null,
              cardSetCategory: asString(split?.cardSetCategory) ?? null,
            },
          ],
        ];
      })
    ),
  };

  const unsupportedFieldsDetected = (parsed.unsupportedFieldsDetected ?? [])
    .filter(
      (field): field is string =>
        typeof field === "string" && field.trim().length > 0
    )
    .map((field) => field.trim());

  return { mapping, unsupportedFieldsDetected };
}

function finalizeSpreadsheetMapping(input: {
  mapping: Dm2ColumnMapping;
  unsupportedFieldsDetected: string[];
  distinctCardSetValues: string[];
  catalogParallels: string[];
  catalogCardSetNames: string[];
  catalogInsertSetNames?: string[];
  model: string;
  promptVersion: string;
}): {
  mapping: Dm2ColumnMapping;
  unsupportedFieldsDetected: string[];
  model: string;
  promptVersion: string;
} {
  return {
    mapping: input.mapping,
    unsupportedFieldsDetected: input.unsupportedFieldsDetected,
    model: input.model,
    promptVersion: input.promptVersion,
  };
}

export async function inferDm2SpreadsheetMappingWithAi(input: {
  fileName: string;
  sheetNames: string[];
  sampleContent: string;
  headers: string[];
  distinctCardSetValues: string[];
  distinctProgramValues: string[];
  catalogParallels: string[];
  catalogCardSetNames: string[];
  catalogInsertSetNames?: string[];
  catalogSummary: string;
  webResearch: string;
  heuristicFallback: Dm2ColumnMapping | null;
}): Promise<{
  mapping: Dm2ColumnMapping;
  unsupportedFieldsDetected: string[];
  model: string;
  promptVersion: string;
}> {
  const cardSetValuesForAi = capDistinctValuesForAi(input.distinctCardSetValues);
  const programValuesForAi = capDistinctValuesForAi(input.distinctProgramValues);
  const promptInput = {
    ...input,
    distinctCardSetValues: cardSetValuesForAi.values,
    distinctProgramValues: programValuesForAi.values,
    distinctCardSetValuesTotal: cardSetValuesForAi.totalCount,
    distinctProgramValuesTotal: programValuesForAi.totalCount,
  };

  const applyHeuristicFallback = (reason: string) => {
    if (!input.heuristicFallback) {
      throw new Error(reason);
    }
    return finalizeSpreadsheetMapping({
      mapping: input.heuristicFallback,
      unsupportedFieldsDetected: [],
      distinctCardSetValues: input.distinctCardSetValues,
      catalogParallels: input.catalogParallels,
      catalogCardSetNames: input.catalogCardSetNames,
      catalogInsertSetNames: input.catalogInsertSetNames,
      model: "heuristic-fallback",
      promptVersion: DM2_IMPORT_PROMPT_VERSION,
    });
  };

  let content: string | null | undefined;
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 16000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: DM2_IMPORT_SPREADSHEET_MAPPING_PROMPT },
        {
          role: "user",
          content: buildDm2SpreadsheetMappingUserMessage(promptInput),
        },
      ],
    });
    content = response.choices[0]?.message?.content;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Spreadsheet mapping request failed.";
    return applyHeuristicFallback(
      `AI column mapping failed (${message}). Heuristic mapping was used instead.`
    );
  }

  if (!content) {
    return applyHeuristicFallback("Could not infer spreadsheet column mapping.");
  }

  let result: {
    mapping: Dm2ColumnMapping;
    unsupportedFieldsDetected: string[];
  };
  try {
    result = parseSpreadsheetMappingResponse(content, input.heuristicFallback);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid mapping response.";
    return applyHeuristicFallback(
      `AI column mapping returned invalid JSON (${message}). Heuristic mapping was used instead.`
    );
  }

  if (
    result.mapping.columns.cardNumber == null &&
    result.mapping.columns.player == null
  ) {
    if (!input.heuristicFallback) {
      throw new Error("Spreadsheet mapping did not identify card rows.");
    }
    result.mapping.columns = {
      ...input.heuristicFallback.columns,
      ...result.mapping.columns,
    };
  }

  return finalizeSpreadsheetMapping({
    mapping: result.mapping,
    unsupportedFieldsDetected: result.unsupportedFieldsDetected,
    distinctCardSetValues: input.distinctCardSetValues,
    catalogParallels: input.catalogParallels,
    catalogCardSetNames: input.catalogCardSetNames,
    catalogInsertSetNames: input.catalogInsertSetNames,
    model: MODEL,
    promptVersion: DM2_IMPORT_PROMPT_VERSION,
  });
}

export async function generateDm2WebSearchQueries(input: {
  fileNames: string[];
  contentPreviews: string[];
}): Promise<string[]> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: DM2_IMPORT_QUERY_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildDm2ImportQueryUserMessage(input),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { queries?: unknown };
  const queries = Array.isArray(parsed.queries) ? parsed.queries : [];
  return queries
    .filter((query): query is string => typeof query === "string" && query.trim().length > 0)
    .map((query) => query.trim())
    .slice(0, 3);
}

export async function extractDm2DataWithAi(input: {
  fileName: string;
  mimeType: string;
  content: string;
  catalogSummary: string;
  webResearch: string;
}): Promise<AiExtractionResult & { model: string; promptVersion: string }> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 8000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: DM2_IMPORT_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildDm2ImportUserMessage(input),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  const result = parseExtractionResponse(content, input.fileName);
  return {
    ...result,
    model: MODEL,
    promptVersion: DM2_IMPORT_PROMPT_VERSION,
  };
}

export interface Dm2ImportRefinementResult {
  sessionContext: Dm2ImportSessionContext;
  rows: Dm2ExtractedRow[];
  suggestions: Dm2FieldSuggestion[];
  researchNotes: Dm2ImportResearchNote[];
  mappingFramework: Dm2MappingFrameworkNote[];
}

function applyFieldUpdate(
  row: Dm2ExtractedRow,
  field: Dm2SuggestionField,
  value: string | number
): Dm2ExtractedRow {
  if (field === "year") {
    const year = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(year)) return row;
    return { ...row, year };
  }

  const stringValue = String(value);
  return { ...row, [field]: stringValue };
}

export async function refineDm2ImportWithAi(input: {
  fileNames: string[];
  sessionContext: Dm2ImportSessionContext;
  rows: Dm2ExtractedRow[];
  catalogSummary: string;
  webResearch: string;
}): Promise<Dm2ImportRefinementResult> {
  const openai = getOpenAIClient();
  const rowSample = input.rows
    .slice(0, 40)
    .map(
      (row) =>
        `${row.sourceFileName}#${row.sourceRowIndex}: ${row.cardNumber ?? "?"} ${row.player ?? "?"} | ${row.manufacturer ?? "?"} / ${row.brand ?? "?"} / ${row.cardSetName ?? "?"}`
    )
    .join("\n");

  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 6000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: DM2_IMPORT_REFINE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildDm2ImportRefineUserMessage({
          fileNames: input.fileNames,
          sessionContext: input.sessionContext,
          rowSample,
          catalogSummary: input.catalogSummary,
          webResearch: input.webResearch,
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      sessionContext: input.sessionContext,
      rows: input.rows,
      suggestions: [],
      researchNotes: [],
      mappingFramework: [],
    };
  }

  const parsed = JSON.parse(content) as {
    sessionContext?: Record<string, unknown>;
    rowUpdates?: Array<{
      sourceFileName?: string;
      sourceRowIndex?: number;
      updates?: Record<string, unknown>;
      confidence?: number;
    }>;
    suggestions?: Array<Record<string, unknown>>;
    researchNotes?: Array<Record<string, unknown>>;
    mappingFramework?: Array<Record<string, unknown>>;
  };

  const sessionContext: Dm2ImportSessionContext = {
    sport:
      asString(parsed.sessionContext?.sport) ?? input.sessionContext.sport,
    year: asYear(parsed.sessionContext?.year) ?? input.sessionContext.year,
    manufacturer:
      asString(parsed.sessionContext?.manufacturer) ??
      input.sessionContext.manufacturer,
    brand: asString(parsed.sessionContext?.brand) ?? input.sessionContext.brand,
    cardSetCategory:
      asString(parsed.sessionContext?.cardSetCategory) ??
      input.sessionContext.cardSetCategory,
    cardSetName:
      asString(parsed.sessionContext?.cardSetName) ??
      input.sessionContext.cardSetName,
  };

  const rows = input.rows.map((row) => ({ ...row }));
  const rowIndex = new Map(
    rows.map((row) => [`${row.sourceFileName}:${row.sourceRowIndex}`, row])
  );

  for (const update of parsed.rowUpdates ?? []) {
    const fileName = asString(update.sourceFileName);
    const rowNumber = update.sourceRowIndex;
    if (!fileName || typeof rowNumber !== "number") continue;

    const row = rowIndex.get(`${fileName}:${rowNumber}`);
    if (!row || asConfidence(update.confidence) < DM2_EXISTING_VALUE_MATCH_THRESHOLD) {
      continue;
    }

    const updates = update.updates ?? {};
    if (updates.sport) row.sport = asString(updates.sport);
    if (updates.year) row.year = asYear(updates.year);
    if (updates.manufacturer) row.manufacturer = asString(updates.manufacturer);
    if (updates.brand) row.brand = asString(updates.brand);
    if (updates.cardSetCategory) {
      row.cardSetCategory = asString(updates.cardSetCategory);
    }
    if (updates.cardSetName) row.cardSetName = asString(updates.cardSetName);
    if (updates.cardNumber) row.cardNumber = asString(updates.cardNumber);
    if (updates.player) row.player = asString(updates.player);
    if (updates.parallel) row.parallel = asString(updates.parallel);
    row.confidence = Math.max(row.confidence, asConfidence(update.confidence));
  }

  const suggestions: Dm2FieldSuggestion[] = (parsed.suggestions ?? [])
    .map((item) => {
      if (!isSuggestionField(item.field)) return null;
      const suggestedValue = item.suggestedValue;
      if (
        suggestedValue == null ||
        (typeof suggestedValue !== "string" && typeof suggestedValue !== "number")
      ) {
        return null;
      }

      const sourceFileName = asString(item.sourceFileName);
      const sourceRowIndex =
        typeof item.sourceRowIndex === "number" ? item.sourceRowIndex : undefined;
      const rowId =
        sourceFileName && sourceRowIndex != null
          ? rows.find(
              (row) =>
                row.sourceFileName === sourceFileName &&
                row.sourceRowIndex === sourceRowIndex
            )?.id
          : undefined;

      const suggestion: Dm2FieldSuggestion = {
        id: randomUUID(),
        field: item.field,
        rowId,
        currentValue:
          typeof item.currentValue === "string" ||
          typeof item.currentValue === "number"
            ? item.currentValue
            : undefined,
        suggestedValue,
        reason:
          typeof item.reason === "string" && item.reason.trim().length > 0
            ? item.reason.trim()
            : "Suggested mapping alignment",
        source:
          item.source === "catalog" ||
          item.source === "web" ||
          item.source === "framework"
            ? item.source
            : "framework",
        confidence: asConfidence(item.confidence),
        applied: false,
      };

      if (
        item.autoApply === true &&
        suggestion.confidence >= DM2_EXISTING_VALUE_MATCH_THRESHOLD
      ) {
        if (rowId) {
          const row = rows.find((entry) => entry.id === rowId);
          if (row) {
            const updated = applyFieldUpdate(
              row,
              suggestion.field,
              suggestion.suggestedValue
            );
            Object.assign(row, updated);
            suggestion.applied = true;
          }
        } else if (
          suggestion.field in sessionContext ||
          ["sport", "year", "manufacturer", "brand", "cardSetCategory", "cardSetName"].includes(
            suggestion.field
          )
        ) {
          if (suggestion.field === "year") {
            const year = asYear(suggestion.suggestedValue);
            if (year) {
              sessionContext.year = year;
              suggestion.applied = true;
            }
          } else {
            sessionContext[suggestion.field as keyof Dm2ImportSessionContext] =
              String(suggestion.suggestedValue) as never;
            suggestion.applied = true;
          }
        }
      }

      return suggestion;
    })
    .filter((item): item is Dm2FieldSuggestion => item != null);

  const researchNotes = (parsed.researchNotes ?? [])
    .map((note) => {
      const title = asString(note.title);
      const detail = asString(note.detail);
      if (!title || !detail) return null;
      return {
        id: randomUUID(),
        source: (note.source === "catalog" || note.source === "web"
          ? note.source
          : "web") as "catalog" | "web",
        title,
        detail,
        url: asString(note.url),
      };
    })
    .filter((note) => note != null) as Dm2ImportResearchNote[];

  const mappingFramework: Dm2MappingFrameworkNote[] = (
    parsed.mappingFramework ?? []
  )
    .map((note) => {
      const pattern = asString(note.pattern);
      const explanation = asString(note.explanation);
      if (!pattern || !explanation) return null;
      return { pattern, explanation };
    })
    .filter((note): note is Dm2MappingFrameworkNote => note != null);

  return {
    sessionContext,
    rows,
    suggestions,
    researchNotes,
    mappingFramework,
  };
}
