import pLimit from "p-limit";
import type { Page } from "playwright";
import type { ChecklistCatalogEntry } from "../catalog/types";
import { PANINI_CHECKLIST } from "../config/panini-basketball";
import {
  formatPaniniChecklistRow,
  paniniChecklistCsvHeader,
  resolveChecklistMetadata,
} from "../compile/panini-csv-format";
// Plain JS export avoids tsx __name injection in page.evaluate callbacks
import { paniniApiCsvEval } from "./panini-api-csv.browser.js";

export const PANINI_API = "https://support.paniniamerica.net/replacement-card-selection";
export const BASKETBALL_ACTIVITY_ID = "9";

const CARD_SET_CONCURRENCY = 5;

interface PaniniApiRow {
  id: number;
  name?: string;
  no?: string;
  player?: string;
  team?: string;
  pos?: string;
}

interface PaniniApiResponse {
  status: number;
  data?: PaniniApiRow[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function postPaniniApi(
  year: string,
  brand: string,
  body: Record<string, string>
): Promise<PaniniApiRow[]> {
  const res = await fetch(PANINI_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": PANINI_CHECKLIST.userAgent,
    },
    body: JSON.stringify({
      activity: BASKETBALL_ACTIVITY_ID,
      year,
      brand,
      program: "",
      card_set: "",
      card: "",
      replace_wo_inventory: "1",
      from_frontend: "0",
      ...body,
    }),
  });

  const json = (await res.json()) as PaniniApiResponse;
  if (json.status !== 200 || !Array.isArray(json.data)) {
    throw new Error(`Panini API error: ${JSON.stringify(json).slice(0, 200)}`);
  }

  await sleep(PANINI_CHECKLIST.apiRateLimitMs);
  return json.data;
}

export async function listProgramsForBrand(
  year: string,
  brand: string
): Promise<PaniniApiRow[]> {
  return postPaniniApi(year, brand, { program: "", from_frontend: "2" });
}

function normalizeProgramName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

export function findProgramMatch(
  programs: PaniniApiRow[],
  setLabel: string
): PaniniApiRow | undefined {
  const target = normalizeProgramName(setLabel);
  return (
    programs.find((p) => normalizeProgramName(p.name ?? "") === target) ??
    programs.find((p) => normalizeProgramName(p.name ?? "").includes(target)) ??
    programs.find((p) => target.includes(normalizeProgramName(p.name ?? "")))
  );
}

export async function fetchChecklistCsvViaNodeApi(
  entry: Pick<ChecklistCatalogEntry, "year" | "brand" | "set_label" | "discovery_meta">
): Promise<Buffer> {
  const { year, brand, set_label: setLabel, discovery_meta: meta } = entry;
  const metadata = resolveChecklistMetadata(entry);

  let programId = meta?.program_id ? String(meta.program_id) : "";
  if (!programId) {
    const programs = await listProgramsForBrand(year, brand);
    const match = findProgramMatch(programs, setLabel);
    if (!match) throw new Error(`Program not found: ${setLabel}`);
    programId = String(match.id);
  }

  const sets = await postPaniniApi(year, brand, { program: programId });
  const rows = [paniniChecklistCsvHeader()];
  const limit = pLimit(CARD_SET_CONCURRENCY);

  const setRows = await Promise.all(
    sets.map((set) =>
      limit(async () => {
        const cards = await postPaniniApi(year, brand, {
          program: programId,
          card_set: String(set.id),
        });
        return cards.map((card) =>
          formatPaniniChecklistRow(metadata, {
            cardSet: set.name ?? "",
            cardNo: card.no ?? "",
            athlete: card.player ?? "",
            team: card.team ?? "",
            position: card.pos ?? "",
          })
        );
      })
    )
  );

  for (const lines of setRows) {
    rows.push(...lines);
  }

  if (rows.length <= 1) throw new Error("No checklist rows returned from Panini API");
  return Buffer.from(rows.join("\r\n"), "utf8");
}

export async function fetchChecklistCsvViaApi(
  page: Page,
  entry: Pick<ChecklistCatalogEntry, "year" | "brand" | "set_label" | "discovery_meta">
): Promise<Buffer> {
  const metadata = resolveChecklistMetadata(entry);
  const csvText = await page.evaluate(paniniApiCsvEval, {
    api: PANINI_API,
    sportId: BASKETBALL_ACTIVITY_ID,
    sport: metadata.Sport,
    year: entry.year,
    brand: entry.brand,
    setLabel: entry.set_label,
    programIdHint: entry.discovery_meta?.program_id ?? null,
  });

  return Buffer.from(String(csvText), "utf8");
}
