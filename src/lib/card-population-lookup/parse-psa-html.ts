import type { GraderPopCandidate } from "@/lib/card-population-lookup/types";

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readCellNumbers(cells: string[]): Record<string, number | null> {
  const counts: Record<string, number | null> = {};
  for (const cell of cells) {
    const grade = cell.match(/psa\s*(\d+(?:\.\d+)?)/i);
    const count = cell.match(/\b(\d[\d,]*)\b/);
    if (grade && count) {
      counts[`psa_${grade[1].replace(".", "_")}`] = Number(count[1].replace(/,/g, ""));
    }
  }
  return counts;
}

/**
 * Parse a simplified PSA-style results table from saved HTML.
 * Live PSA pages are JS-rendered and often Cloudflare-gated; this is the
 * fixture contract the matching POC is built against.
 */
export function parsePsaSearchTableHtml(
  html: string,
  setName = "Unknown set"
): GraderPopCandidate[] {
  const year = Number(setName.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? NaN);
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const candidates: GraderPopCandidate[] = [];

  let rowMatch = rowPattern.exec(html);
  while (rowMatch) {
    const rowHtml = rowMatch[1];
    if (/<th\b/i.test(rowHtml)) {
      rowMatch = rowPattern.exec(html);
      continue;
    }
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      decode(cell[1])
    );
    if (cells.length < 3) {
      rowMatch = rowPattern.exec(html);
      continue;
    }

    const cardNumber = cells[0] ?? "";
    const subject = cells[1] ?? "";
    const variety = cells[2] ?? "Base";
    if (!cardNumber || !subject) {
      rowMatch = rowPattern.exec(html);
      continue;
    }

    const countsFromLabeled = readCellNumbers(cells.slice(3));
    const counts =
      Object.keys(countsFromLabeled).length > 0
        ? countsFromLabeled
        : {
            psa_8: Number((cells[3] ?? "").replace(/,/g, "")) || null,
            psa_9: Number((cells[4] ?? "").replace(/,/g, "")) || null,
            psa_10: Number((cells[5] ?? "").replace(/,/g, "")) || null,
          };

    candidates.push({
      grader: "PSA",
      setName,
      year: Number.isFinite(year) ? year : null,
      cardNumber,
      subject,
      variety,
      counts,
    });
    rowMatch = rowPattern.exec(html);
  }

  return candidates;
}
