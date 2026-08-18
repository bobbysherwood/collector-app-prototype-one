import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type { ChecklistCatalogEntry } from "../catalog/types";
import {
  COMPILE_TARGET_MAX_BYTES,
  COMPILE_TARGET_MAX_ROWS,
} from "./ai-loader-limits";
import {
  PANINI_CHECKLIST_CSV_COLUMNS,
  PANINI_METADATA_COLUMNS,
  resolveChecklistMetadata,
} from "./panini-csv-format";

export interface ConcatResult {
  csv: string;
  columns: string[];
  rowCount: number;
  byteSize: number;
}

export function buildNormalizedRows(
  sources: Array<{ path: string; entry: ChecklistCatalogEntry; bytes: Buffer }>
): Record<string, string>[] {
  const sorted = [...sources].sort((a, b) => {
    const yearCmp = a.entry.year.localeCompare(b.entry.year);
    if (yearCmp !== 0) return yearCmp;
    return a.entry.set_label.localeCompare(b.entry.set_label);
  });

  const rows: Record<string, string>[] = [];

  for (const source of sorted) {
    let records: Record<string, string>[];
    try {
      records = parse(source.bytes, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
      }) as Record<string, string>[];
    } catch (err) {
      throw new Error(
        `Parse error for ${source.entry.id}: ${err instanceof Error ? err.message : err}`
      );
    }

    if (records.length === 0) continue;

    const metadata = resolveChecklistMetadata(source.entry);

    for (const record of records) {
      const row: Record<string, string> = {};
      for (const col of PANINI_CHECKLIST_CSV_COLUMNS) {
        if ((PANINI_METADATA_COLUMNS as readonly string[]).includes(col)) {
          row[col] = (record[col] ?? metadata[col as keyof typeof metadata] ?? "").trim();
        } else {
          row[col] = record[col] ?? "";
        }
      }
      rows.push(row);
    }
  }

  return rows;
}

export function serializeChecklistCsv(rows: Record<string, string>[]): ConcatResult {
  const columns = [...PANINI_CHECKLIST_CSV_COLUMNS];
  const data = rows.map((row) => columns.map((col) => row[col] ?? ""));
  const csv = stringify([columns, ...data]);
  const byteSize = Buffer.byteLength(csv, "utf8");

  return { csv, columns, rowCount: rows.length, byteSize };
}

export function concatCsvFiles(
  sources: Array<{ path: string; entry: ChecklistCatalogEntry; bytes: Buffer }>
): ConcatResult {
  const rows = buildNormalizedRows(sources);
  return serializeChecklistCsv(rows);
}

export function splitChecklistCsv(
  rows: Record<string, string>[],
  maxBytes: number = COMPILE_TARGET_MAX_BYTES,
  maxRows: number = COMPILE_TARGET_MAX_ROWS
): ConcatResult[] {
  if (rows.length === 0) return [];

  const chunks: ConcatResult[] = [];
  let start = 0;

  while (start < rows.length) {
    let end = Math.min(start + maxRows, rows.length);
    let chunk = serializeChecklistCsv(rows.slice(start, end));

    while (chunk.byteSize > maxBytes && end > start + 1) {
      end = start + Math.max(1, Math.ceil((end - start) / 2));
      chunk = serializeChecklistCsv(rows.slice(start, end));
    }

    if (chunk.byteSize > maxBytes) {
      throw new Error(
        `Single row exceeds compile size limit (${chunk.byteSize} bytes > ${maxBytes})`
      );
    }

    chunks.push(chunk);
    start = end;
  }

  return chunks;
}
