import * as XLSX from "xlsx";
import type { CardRepositoryEntryInput } from "@/types/card-repository";

export const CARD_REPOSITORY_IMPORT_COLUMNS = [
  "Category",
  "Year",
  "Manufacturer",
  "Brand",
  "Card Set Category",
  "Card Set",
  "Card Number",
  "Player",
  "Parallel",
  "Serial Number",
  "Release Date",
] as const;

const REQUIRED_COLUMN_INDEXES = new Set([0, 1, 2, 3, 4, 5, 6, 7]);

export interface CardRepositoryImportResult {
  entries: CardRepositoryEntryInput[];
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

function parseOptionalSerialNumber(
  value: unknown,
  rowNumber: number
): number | undefined {
  const raw = cellValue(value);
  if (!raw) return undefined;
  const serial = Number(raw);
  if (!Number.isInteger(serial) || serial <= 0) {
    throw new Error(`Row ${rowNumber}: Serial Number must be a positive whole number.`);
  }
  return serial;
}

function parseOptionalReleaseDate(value: unknown, rowNumber: number): string | undefined {
  if (value == null || value === "") return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${month}-${day}`;
    }
  }

  const raw = cellValue(value);
  if (!raw) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  throw new Error(`Row ${rowNumber}: Release Date is not a valid date.`);
}

function isHeaderRow(row: unknown[]): boolean {
  const first = cellValue(row[0]).toLowerCase();
  return first === "category";
}

function parseRow(row: unknown[], rowNumber: number): CardRepositoryEntryInput {
  if (row.length < 8) {
    throw new Error(`Row ${rowNumber}: Not enough columns. Expected at least 8 required fields.`);
  }

  const values = CARD_REPOSITORY_IMPORT_COLUMNS.map((_, index) => row[index]);

  for (const index of REQUIRED_COLUMN_INDEXES) {
    if (!cellValue(values[index])) {
      throw new Error(
        `Row ${rowNumber}: ${CARD_REPOSITORY_IMPORT_COLUMNS[index]} is required.`
      );
    }
  }

  const category = cellValue(values[0]);
  const manufacturer = cellValue(values[2]);
  const brand = cellValue(values[3]);
  const cardSetCategory = cellValue(values[4]);
  const cardSet = cellValue(values[5]);
  const cardNumber = cellValue(values[6]);
  const player = cellValue(values[7]);
  const parallel = cellValue(values[8]);
  const year = parseYear(values[1], rowNumber);
  if (year == null) {
    throw new Error(`Row ${rowNumber}: Year is required.`);
  }

  return {
    category,
    year,
    manufacturer,
    brand,
    cardSetCategory,
    cardSet,
    cardNumber,
    player,
    parallel: parallel || undefined,
    serialNumber: parseOptionalSerialNumber(values[9], rowNumber),
    releaseDate: parseOptionalReleaseDate(values[10], rowNumber),
  };
}

export function parseCardRepositoryExcel(buffer: ArrayBuffer): CardRepositoryImportResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { entries: [], errors: ["The Excel file does not contain any worksheets."] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const entries: CardRepositoryEntryInput[] = [];
  const errors: string[] = [];
  let startIndex = 0;

  if (rows.length > 0 && Array.isArray(rows[0]) && isHeaderRow(rows[0])) {
    startIndex = 1;
  }

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    if (!Array.isArray(row)) {
      continue;
    }

    const hasValues = row.some((value) => cellValue(value) !== "");
    if (!hasValues) {
      continue;
    }

    try {
      entries.push(parseRow(row, rowNumber));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Row ${rowNumber}: Invalid row.`);
    }
  }

  if (entries.length === 0 && errors.length === 0) {
    errors.push("No card rows were found in the Excel file.");
  }

  return { entries, errors };
}
