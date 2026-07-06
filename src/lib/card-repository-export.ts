import * as XLSX from "xlsx";
import { CARD_REPOSITORY_IMPORT_COLUMNS } from "@/lib/card-repository-import";
import type { CardRepositoryExportRow } from "@/types/card-repository";

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, " ").trim();
}

export function downloadCardRepositorySetExcel(
  setLabel: string,
  cards: CardRepositoryExportRow[]
) {
  const rows: (string | number)[][] = [
    [...CARD_REPOSITORY_IMPORT_COLUMNS],
    ...cards.map((card) => [
      card.category,
      card.year,
      card.manufacturer,
      card.brand,
      card.cardSetCategory,
      card.cardSet,
      card.cardNumber,
      card.player,
      card.parallel ?? "",
      card.serialNumber ?? "",
      card.releaseDate ?? "",
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cards");

  const filename = `${sanitizeFilename(setLabel) || "card-set"}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
