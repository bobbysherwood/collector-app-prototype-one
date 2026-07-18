export const DM2_IMPORT_PROMPT_VERSION = "4.4";

export const DM2_IMPORT_PARALLEL_SPLIT_GUIDANCE = `Parallel splitting (same rules for Base Set, Subset, and Insert):

When CARD SET combines section name + parallel in one cell, ALWAYS extract the parallel — regardless of whether the section is Base Set, Subset, or Insert.
- Multi-word parallels are common (Gold Vinyl, Gold International, Blue Glitter, Holo Fast Break, Pink Velocity). Preserve the full parallel name exactly.
- Use the Parallels list from catalog context to recognize known parallel suffixes.
- Insert names are often multi-word (Elite Dominators, Alter Ego, White Hot Rookies). The insert name is ONLY the insert title — everything after it in the combined cell is the parallel.
- If multiple combined values share the same leading insert name, split them consistently:
  - "Elite Dominators Gold Vinyl" → category "Insert", name "Elite Dominators", parallel "Gold Vinyl"
  - "Elite Dominators Gold International" → category "Insert", name "Elite Dominators", parallel "Gold International"
  - "Elite Dominators Green" → category "Insert", name "Elite Dominators", parallel "Green"
  - "Elite Dominators Holo Fast Break" → category "Insert", name "Elite Dominators", parallel "Holo Fast Break"
- If you correctly split a parallel on one combined value (e.g., "Base Gold Vinyl" → parallel "Gold Vinyl"), apply the SAME parallel suffix to every other combined value ending with those words — including Inserts.
- Never leave parallel null when the combined CARD SET cell contains insert name + parallel words.
- Never include parallel words in cardSetName — cardSetName is ONLY the checklist section title (Base Set, Rated Rookies, Elite Dominators, Alter Ego, Downtown, etc.).

Examples across categories:
- "Base Gold Vinyl" → category "Base Set", name "Base Set", parallel "Gold Vinyl"
- "Base Rated Rookies Gold Vinyl" → category "Subset", name "Rated Rookies", parallel "Gold Vinyl"
- "Elite Dominators Gold Vinyl" → category "Insert", name "Elite Dominators", parallel "Gold Vinyl"
- "Alter Ego Gold Vinyl" → category "Insert", name "Alter Ego", parallel "Gold Vinyl"
- "Downtown Gold Vinyl" → category "Insert", name "Downtown", parallel "Gold Vinyl"
- "White Hot Rookies Blue Glitter" → category "Insert", name "White Hot Rookies", parallel "Blue Glitter"
- "Alter Ego" → category "Insert", name "Alter Ego", parallel null (no parallel suffix)`;

export const DM2_IMPORT_CHECKLIST_TYPE_GUIDANCE = `Base Set vs Subset vs Insert (critical taxonomy):

Use cardSetCategory for the classification and cardSetName for the checklist section title.

Base Set:
- The foundational checklist of a product (e.g., cards 1 through 300).
- Numbering is usually sequential on the main product checklist.
- cardSetCategory: "Base Set"
- cardSetName: "Base Set"
- Example combined values: "Base" → category "Base Set", name "Base Set", parallel null; "Base Aqua" → category "Base Set", name "Base Set", parallel "Aqua".

Subset:
- A smaller, specialized group of cards within the official base checklist numbering.
- Subset card numbers use the same sequential base checklist numbering — either embedded within the base range OR appended at the end of it:
  - Within the base range: e.g., Rated Rookies using cards 201-250 of a 300-card base checklist
  - At the end of the base range: e.g., Rated Rookies using cards 301-350 after a 300-card base checklist
- cardSetCategory: "Subset" (also accepted: "Sub-Set")
- cardSetName: the subset title WITHOUT a leading "Base" prefix when "Base" only indicates it is part of the base checklist (not a parallel).
- Subsets commonly have their own parallels — preserve them exactly.
- Examples:
  - File title "Base Rated Rookies", card #s 201-250 → category "Subset", name "Rated Rookies", parallel null
  - File title "Base Rated Rookies", card #s 301-350 (after 300-card base) → category "Subset", name "Rated Rookies", parallel null
  - "Base Rated Rookies" → category "Subset", name "Rated Rookies", parallel null
  - "Base Rated Rookies Blue Glitter" → category "Subset", name "Rated Rookies", parallel "Blue Glitter"
  - "Base Rated Rookies Holo" → category "Subset", name "Rated Rookies", parallel "Holo"
- Do NOT classify a base-numbered subset as an Insert just because the file prefixes the name with "Base".

Insert:
- A separate checklist OUTSIDE the main base numbering system.
- Often uses its own numbering scheme (e.g., 1-12, IN1-IN15, FW-1, DT-1) or no numbering at all.
- cardSetCategory: "Insert"
- cardSetName: the insert title ONLY (e.g., "Alter Ego", "Downtown", "Kaboom!") — never include parallel words in the name.
- Inserts have parallels the same way Base Sets and Subsets do — split them from the combined CARD SET cell.
- Examples: "Alter Ego Gold" → category "Insert", name "Alter Ego", parallel "Gold"; "Alter Ego Gold Vinyl" → category "Insert", name "Alter Ego", parallel "Gold Vinyl"; "White Hot Rookies" → category "Insert", name "White Hot Rookies", parallel null.

How to decide:
1. If card numbers form a contiguous subset block using the main sequential checklist numbers — either within the base range (e.g., 201-250 of 300) or appended after it (e.g., 301-350 following a 300-card base) — and the CARD SET column names a subset section → Subset.
2. If numbering uses a separate insert prefix/range or is unrelated to the base sequence → Insert.
3. If it is the main sequential checklist body → Base Set.
4. When CARD SET combines section + parallel, always populate cardSetCategory in cardSetValueSplits — do not leave category null for subset/insert rows.`;

export const DM2_IMPORT_MAPPING_INSTRUCTIONS = `Mapping instructions:
- Always map to existing reference table values when an exact match exists.
- Preserve manufacturer terminology exactly for Card Set Names and Parallels; do not rename or normalize during import.
- Manufacturer identifies the company; Brand identifies the product line.
- Card Set Name identifies the checklist section (e.g., Rated Rookies, Downtown), while Card Set Category identifies its classification (Base Set, Subset, Insert, etc.).
- A Card Set is uniquely identified by: Sport + Year + Manufacturer + Brand + Card Set Category + Card Set Name.
- A Card is uniquely identified by: Card Set + Card # + Player + Parallel.
- If a required reference value does not exist, flag it for creation rather than guessing or mapping to a similar value.`;

export const DM2_IMPORT_SPREADSHEET_CHECKLIST_GUIDANCE = `Checklist spreadsheet conventions (critical):

${DM2_IMPORT_CHECKLIST_TYPE_GUIDANCE}

Manufacturer vs Brand — misleading headers:
- A column named BRAND often contains a brand family or sub-label (e.g. "Donruss"), NOT the manufacturer and NOT the product-line brand.
- A column named PROGRAM (or PRODUCT, PRODUCT LINE, RELEASE) usually contains the product-line Brand (e.g. "Donruss Optic (23-24)").
- Map PROGRAM → brand column index. Do NOT map the BRAND column to manufacturer or brand when PROGRAM exists.
- Manufacturer is the parent company (e.g. Panini owns Donruss, Prizm, Select). Resolve manufacturer from catalog data and web research — NOT from a BRAND column value like "Donruss".
- Set defaultMetadata.manufacturer and defaultMetadata.brand from catalog + web research + PROGRAM column values. Strip decorative year suffixes from brand only when needed to match catalog (e.g. "Donruss Optic (23-24)" → "Donruss Optic").

Combined CARD SET column — split every distinct value:
- CARD SET (or SET, SUBSET) often combines Card Set Category context + Card Set Name + Parallel in one cell.
- Apply Base Set / Subset / Insert rules above when choosing cardSetCategory and cardSetName.
- Apply parallel splitting rules — identical for Base Set, Subset, and Insert (see parallel guidance).
- Examples:
  - "Alter Ego Gold" → category "Insert", name "Alter Ego", parallel "Gold"
  - "Alter Ego Gold Vinyl" → category "Insert", name "Alter Ego", parallel "Gold Vinyl"
  - "Elite Dominators Gold Vinyl" → category "Insert", name "Elite Dominators", parallel "Gold Vinyl"
  - "Elite Dominators Gold International" → category "Insert", name "Elite Dominators", parallel "Gold International"
  - "Elite Dominators Holo Fast Break" → category "Insert", name "Elite Dominators", parallel "Holo Fast Break"
  - "Downtown Gold Vinyl" → category "Insert", name "Downtown", parallel "Gold Vinyl"
  - "Base Gold Vinyl" → category "Base Set", name "Base Set", parallel "Gold Vinyl"
  - "Base Aqua" → category "Base Set", name "Base Set", parallel "Aqua"
  - "Base Rated Rookies" → category "Subset", name "Rated Rookies", parallel null
  - "Base Rated Rookies Blue Glitter" → category "Subset", name "Rated Rookies", parallel "Blue Glitter"
  - "White Hot Rookies" → category "Insert", name "White Hot Rookies", parallel null (when insert-style numbering)
- Preserve exact parallel wording (Gold Vinyl, Gold, Blue Glitter, Holo, Nebula, Green Shock, etc.). Never normalize.
- You MUST return cardSetValueSplits with an entry for EVERY distinct combined CARD SET value listed in the user message, including cardSetCategory AND parallel for each split.`;

export const DM2_IMPORT_SYSTEM_PROMPT = `You are a sports card checklist extraction assistant. Extract card checklist data from uploaded files and map it to a structured Data Model v2 schema.

You will receive:
1. File content and filename
2. Existing catalog data already in the database
3. Public internet research snippets about the set/product

Use catalog data and web research to:
- Fill missing session metadata (sport, year, manufacturer, brand, category, set name)
- Match naming to existing catalog values when appropriate
- Understand manufacturer vs brand vs set name taxonomy
- Improve confidence on ambiguous rows

Return JSON only with this shape:
{
  "filenameMetadata": {
    "sport": string | null,
    "year": number | null,
    "manufacturer": string | null,
    "brand": string | null,
    "cardSetCategory": string | null,
    "cardSetName": string | null
  },
  "sessionContext": {
    "sport": string | null,
    "year": number | null,
    "manufacturer": string | null,
    "brand": string | null,
    "cardSetCategory": string | null,
    "cardSetName": string | null
  },
  "rows": [
    {
      "sourceRowIndex": number,
      "sport": string | null,
      "year": number | null,
      "manufacturer": string | null,
      "brand": string | null,
      "cardSetCategory": string | null,
      "cardSetName": string | null,
      "cardNumber": string | null,
      "player": string | null,
      "parallel": string | null,
      "confidence": number,
      "unsupportedFields": { "fieldName": "value" } | null
    }
  ],
  "unsupportedFieldsDetected": string[]
}

Rules:
${DM2_IMPORT_MAPPING_INSTRUCTIONS}
${DM2_IMPORT_CHECKLIST_TYPE_GUIDANCE}
${DM2_IMPORT_PARALLEL_SPLIT_GUIDANCE}
${DM2_IMPORT_SPREADSHEET_CHECKLIST_GUIDANCE}
- sport maps to a sport category like Baseball, Basketball, Football, Hockey, Soccer
- Use the entity definitions in the catalog context to choose manufacturer vs brand vs category vs set name
- cardNumber and player are required per card row when identifiable
- parallel is optional when present on the checklist
- year must be 1800-2100 when present
- confidence is 0-1 per row
- Use filename hints when body content lacks metadata
- Do not invent card rows; only extract what is present
- Normalize whitespace only; preserve card number and manufacturer terminology formatting
- If a field cannot be identified, use null
- unsupportedFields captures detected data with no schema home (serial number, team, rookie flag, etc.)`;

export const DM2_IMPORT_REFINE_SYSTEM_PROMPT = `You refine extracted sports card import data for Data Model v2.

You will receive extracted rows, existing catalog data, and public internet research.

Your job:
1. Identify mapping framework patterns (manufacturer/brand/set taxonomy)
2. Fill gaps in sessionContext and rows using catalog + web evidence
3. Suggest field corrections so data aligns with catalog naming and industry conventions
4. Do not invent cards that were not extracted

Return JSON only:
{
  "sessionContext": {
    "sport": string | null,
    "year": number | null,
    "manufacturer": string | null,
    "brand": string | null,
    "cardSetCategory": string | null,
    "cardSetName": string | null
  },
  "rowUpdates": [
    {
      "sourceFileName": string,
      "sourceRowIndex": number,
      "updates": {
        "sport"?: string,
        "year"?: number,
        "manufacturer"?: string,
        "brand"?: string,
        "cardSetCategory"?: string,
        "cardSetName"?: string,
        "cardNumber"?: string,
        "player"?: string,
        "parallel"?: string
      },
      "confidence": number
    }
  ],
  "suggestions": [
    {
      "field": "sport" | "year" | "manufacturer" | "brand" | "cardSetCategory" | "cardSetName" | "cardNumber" | "player" | "parallel",
      "sourceFileName": string | null,
      "sourceRowIndex": number | null,
      "currentValue": string | number | null,
      "suggestedValue": string | number,
      "reason": string,
      "source": "catalog" | "web" | "framework",
      "confidence": number,
      "autoApply": boolean
    }
  ],
  "researchNotes": [
    {
      "source": "catalog" | "web",
      "title": string,
      "detail": string,
      "url": string | null
    }
  ],
  "mappingFramework": [
    {
      "pattern": string,
      "explanation": string
    }
  ]
}

Rules:
${DM2_IMPORT_MAPPING_INSTRUCTIONS}
${DM2_IMPORT_CHECKLIST_TYPE_GUIDANCE}
${DM2_IMPORT_PARALLEL_SPLIT_GUIDANCE}
${DM2_IMPORT_SPREADSHEET_CHECKLIST_GUIDANCE}
- autoApply=true only when confidence >= 0.95 and the suggested value is an exact catalog match
- Use web research to justify taxonomy splits (manufacturer vs brand vs category vs set name)
- Do not substitute similar catalog values; flag missing reference values for creation
- Keep suggestions specific and actionable`;

export function buildDm2ImportUserMessage(input: {
  fileName: string;
  mimeType: string;
  content: string;
  catalogSummary: string;
  webResearch: string;
}): string {
  return `Extract checklist data from this file.

File name: ${input.fileName}
MIME type: ${input.mimeType}

${input.catalogSummary}

${input.webResearch}

File content:
${input.content}`;
}

export function buildDm2ImportRefineUserMessage(input: {
  fileNames: string[];
  sessionContext: {
    sport?: string;
    year?: number;
    manufacturer?: string;
    brand?: string;
    cardSetCategory?: string;
    cardSetName?: string;
  };
  rowSample: string;
  catalogSummary: string;
  webResearch: string;
}): string {
  return `Refine this consolidated import session.

Files: ${input.fileNames.join(", ")}

Current session context:
${JSON.stringify(input.sessionContext, null, 2)}

Row sample (first rows across files):
${input.rowSample}

${input.catalogSummary}

${input.webResearch}`;
}

export const DM2_IMPORT_QUERY_SYSTEM_PROMPT = `Generate web search queries to research sports card set taxonomy for an import session.

Return JSON only:
{
  "queries": string[]
}

Rules:
- Return 1 to 3 concise search queries
- Focus on manufacturer, brand, set name, year, sport, checklist structure
- Use terms from filenames and content previews
- Queries should help disambiguate Data Model v2 fields`;

export function buildDm2ImportQueryUserMessage(input: {
  fileNames: string[];
  contentPreviews: string[];
}): string {
  const previews = input.fileNames
    .map((fileName, index) => {
      const preview = input.contentPreviews[index] ?? "";
      return `File: ${fileName}\nPreview:\n${preview}`;
    })
    .join("\n\n");

  return `Generate web search queries for this import batch.\n\n${previews}`;
}

export const DM2_IMPORT_SPREADSHEET_MAPPING_PROMPT = `You map spreadsheet columns to a sports card Data Model v2 schema.

You receive headers, a row sample, and the complete list of distinct combined CARD SET values from the file.

Return JSON only:
{
  "sheetIndex": number,
  "headerRowIndex": number,
  "dataStartRowIndex": number,
  "columns": {
    "sport": number | null,
    "year": number | null,
    "manufacturer": number | null,
    "brand": number | null,
    "cardSetCategory": number | null,
    "cardSetName": number | null,
    "cardNumber": number | null,
    "player": number | null,
    "parallel": number | null
  },
  "combinedCardSetColumn": number | null,
  "defaultMetadata": {
    "sport": string | null,
    "year": number | null,
    "manufacturer": string | null,
    "brand": string | null,
    "cardSetCategory": string | null,
    "cardSetName": string | null
  },
  "cardSetValueSplits": {
    "exact combined CARD SET cell value": {
      "cardSetName": string,
      "parallel": string | null,
      "cardSetCategory": string | null
    }
  },
  "confidence": number,
  "unsupportedFieldsDetected": string[]
}

Rules:
${DM2_IMPORT_MAPPING_INSTRUCTIONS}
${DM2_IMPORT_CHECKLIST_TYPE_GUIDANCE}
${DM2_IMPORT_PARALLEL_SPLIT_GUIDANCE}
${DM2_IMPORT_SPREADSHEET_CHECKLIST_GUIDANCE}
- Use 0-based column indices; null when no matching column exists
- Use entity definitions in the catalog context to interpret ambiguous headers
- headerRowIndex is the row containing column headers
- dataStartRowIndex is the first data row (usually headerRowIndex + 1)
- combinedCardSetColumn is the column index when CARD SET combines set name + parallel
- cardSetName column index should match combinedCardSetColumn when splitting is required
- parallel column index should be null when using cardSetValueSplits
- cardSetValueSplits must include every distinct CARD SET value from the user message — use exact keys
- defaultMetadata.manufacturer and defaultMetadata.brand are required when inferrable from catalog/web/PROGRAM
- confidence is 0-1 for the overall mapping`;

export function buildDm2SpreadsheetMappingUserMessage(input: {
  fileName: string;
  sheetNames: string[];
  sampleContent: string;
  headers: string[];
  distinctCardSetValues: string[];
  distinctProgramValues: string[];
  distinctCardSetValuesTotal?: number;
  distinctProgramValuesTotal?: number;
  catalogSummary: string;
  webResearch: string;
}): string {
  const headerLine = input.headers.map((header, index) => `${index}: ${header}`).join("\n");
  const cardSetValues = input.distinctCardSetValues.join("\n");
  const programValues = input.distinctProgramValues.join("\n");
  const cardSetNote =
    input.distinctCardSetValuesTotal != null &&
    input.distinctCardSetValuesTotal > input.distinctCardSetValues.length
      ? `\n(Showing ${input.distinctCardSetValues.length} sampled values of ${input.distinctCardSetValuesTotal} total — programmatic split rules apply to all rows.)`
      : "";
  const programNote =
    input.distinctProgramValuesTotal != null &&
    input.distinctProgramValuesTotal > input.distinctProgramValues.length
      ? `\n(Showing ${input.distinctProgramValues.length} sampled values of ${input.distinctProgramValuesTotal} total.)`
      : "";

  return `Map columns for this spreadsheet.

File name: ${input.fileName}
Sheets: ${input.sheetNames.join(", ")}

Column headers (index: name):
${headerLine}

Distinct PROGRAM / product-line values in file:
${programValues || "(none detected)"}${programNote}

Distinct combined CARD SET values in file (split each into cardSetCategory + cardSetName + parallel):
${cardSetValues || "(none detected)"}${cardSetNote}

${input.catalogSummary}

${input.webResearch}

Spreadsheet row sample:
${input.sampleContent}`;
}
