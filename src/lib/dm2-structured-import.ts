import * as XLSX from "xlsx";

export const DM2_STRUCTURED_IMPORT_COLUMNS = [
  "Sport",
  "Year",
  "Manufacturer",
  "Brand",
  "Card Set Category",
  "Card Set Name",
  "Card Number",
  "Player",
  "Parallel",
] as const;

export type Dm2StructuredImportColumn =
  (typeof DM2_STRUCTURED_IMPORT_COLUMNS)[number];

export const DM2_STRUCTURED_IMPORT_REQUIRED_COLUMNS =
  DM2_STRUCTURED_IMPORT_COLUMNS.slice(0, 8);

export const DM2_STRUCTURED_IMPORT_OPTIONAL_COLUMNS =
  DM2_STRUCTURED_IMPORT_COLUMNS.slice(8);

const REQUIRED_COLUMN_INDEXES = new Set([0, 1, 2, 3, 4, 5, 6, 7]);

export interface Dm2StructuredImportRow {
  sourceRowIndex: number;
  sport: string;
  year: number;
  manufacturer: string;
  brand: string;
  cardSetCategory: string;
  cardSetName: string;
  cardNumber: string;
  player: string;
  parallel?: string;
}

export interface Dm2StructuredImportResult {
  rows: Dm2StructuredImportRow[];
  errors: string[];
}

function cellValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseYear(value: unknown, rowNumber: number): number | null {
  const raw = cellValue(value);
  if (!raw) return null;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1800 || year > 2100) {
    throw new Error(`Row ${rowNumber}: Year must be a valid whole number.`);
  }
  return year;
}

function isHeaderRow(row: unknown[]): boolean {
  const first = cellValue(row[0]).toLowerCase();
  return first === "sport";
}

function parseRow(row: unknown[], rowNumber: number): Dm2StructuredImportRow {
  if (row.length < DM2_STRUCTURED_IMPORT_REQUIRED_COLUMNS.length) {
    throw new Error(
      `Row ${rowNumber}: Not enough columns. Expected at least ${DM2_STRUCTURED_IMPORT_REQUIRED_COLUMNS.length} required fields.`
    );
  }

  const values = DM2_STRUCTURED_IMPORT_COLUMNS.map((_, index) => row[index]);

  for (const index of REQUIRED_COLUMN_INDEXES) {
    if (!cellValue(values[index])) {
      throw new Error(
        `Row ${rowNumber}: ${DM2_STRUCTURED_IMPORT_COLUMNS[index]} is required.`
      );
    }
  }

  const year = parseYear(values[1], rowNumber);
  if (year == null) {
    throw new Error(`Row ${rowNumber}: Year is required.`);
  }

  const parallel = cellValue(values[8]);

  return {
    sourceRowIndex: rowNumber,
    sport: cellValue(values[0]),
    year,
    manufacturer: cellValue(values[2]),
    brand: cellValue(values[3]),
    cardSetCategory: cellValue(values[4]),
    cardSetName: cellValue(values[5]),
    cardNumber: cellValue(values[6]),
    player: cellValue(values[7]),
    parallel: parallel || undefined,
  };
}

export function parseDm2StructuredExcel(buffer: ArrayBuffer): Dm2StructuredImportResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      rows: [],
      errors: ["The Excel file does not contain any worksheets."],
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const rows: Dm2StructuredImportRow[] = [];
  const errors: string[] = [];
  let startIndex = 0;

  if (rawRows.length > 0 && Array.isArray(rawRows[0]) && isHeaderRow(rawRows[0])) {
    startIndex = 1;
  }

  for (let index = startIndex; index < rawRows.length; index++) {
    const row = rawRows[index];
    const rowNumber = index + 1;

    if (!Array.isArray(row)) continue;

    const hasValues = row.some((value) => cellValue(value) !== "");
    if (!hasValues) continue;

    try {
      rows.push(parseRow(row, rowNumber));
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : `Row ${rowNumber}: Invalid row.`
      );
    }
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No card rows were found in the Excel file.");
  }

  return { rows, errors };
}
