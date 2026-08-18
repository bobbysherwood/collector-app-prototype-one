# Checklist Harvest Agent — V1 Implementation Spec

**Version:** 1.0  
**Status:** Ready for implementation  
**Scope:** Panini Basketball checklists → compiled CSV per brand per sport  
**Prerequisite:** [Locked requirements](./checklist-harvest-v1-requirements.md) (conversation 2026-08-06)

---

## 1. Overview

This spec defines how to build the V1 Checklist Harvest Agent: a **Node.js CLI** using **Playwright** to discover and download Panini Basketball CSV checklists, merge them by **brand + sport**, and publish to a **staging → approved** folder workflow with **human approval**. No admin UI in V1.

### Design principles

1. **Preserve source fidelity** — raw CSV columns; no manufacturer/brand inference.
2. **Append-only provenance** — agent adds `_harvest_*` columns; never rewrites source columns.
3. **Resumable runs** — catalog + checksums enable incremental retry.
4. **Storage adapter abstraction** — local filesystem (dev) and Supabase Storage (shared staging).
5. **Extensible discoverer registry** — V2 adds Topps PDF without rewriting the pipeline.

---

## 2. Repository layout

```
collector-app-prototype-one/
├── docs/
│   └── checklist-harvest-v1-implementation-spec.md   # this file
├── scripts/
│   └── checklist-harvest/
│       ├── cli.ts                    # entrypoint (commander or yargs)
│       ├── commands/
│       │   ├── run.ts
│       │   ├── discover.ts
│       │   ├── download.ts
│       │   ├── compile.ts
│       │   ├── approve.ts
│       │   └── status.ts
│       ├── config/
│       │   └── panini-basketball.ts  # URLs, selectors, rate limits
│       ├── discoverers/
│       │   ├── types.ts
│       │   └── panini-basketball.ts
│       ├── download/
│       │   └── csv-downloader.ts
│       ├── compile/
│       │   ├── brand-compiler.ts
│       │   └── column-union.ts
│       ├── storage/
│       │   ├── types.ts
│       │   ├── local-storage.ts
│       │   └── supabase-storage.ts
│       ├── catalog/
│       │   ├── types.ts
│       │   └── catalog-store.ts
│       ├── manifest/
│       │   └── run-manifest.ts
│       └── utils/
│           ├── slug.ts
│           ├── checksum.ts
│           └── logger.ts
├── data/
│   └── checklist-harvest/            # local dev mirror (gitignored)
│       ├── catalog/
│       ├── staging/
│       └── approved/
└── .gitignore                        # add data/checklist-harvest/
```

### npm scripts (to add)

```json
{
  "checklist-harvest": "tsx scripts/checklist-harvest/cli.ts",
  "checklist-harvest:run": "tsx scripts/checklist-harvest/cli.ts run",
  "checklist-harvest:approve": "tsx scripts/checklist-harvest/cli.ts approve"
}
```

### Dependencies (to add)

| Package | Purpose |
|---------|---------|
| `playwright` | Panini dropdown discovery + download trigger |
| `commander` or `yargs` | CLI parsing |
| `@supabase/supabase-js` | Storage adapter (service role for uploads) |
| `csv-parse` / `csv-stringify` | Merge without loading entire files into memory if possible |
| `p-limit` | Concurrency / rate limiting |

---

## 3. CLI specification

### 3.1 Global options

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `--storage local` | `CHECKLIST_HARVEST_STORAGE` | `local` | `local` \| `supabase` |
| `--root <path>` | `CHECKLIST_HARVEST_ROOT` | `./data/checklist-harvest` | Local storage root |
| `--verbose` | — | false | Debug logging |
| `--json-logs` | — | false | Structured JSON lines to stdout |

### 3.2 Commands

#### `discover`

Enumerate Panini Basketball checklist targets; update catalog only (no download).

```bash
pnpm checklist-harvest discover \
  [--sport basketball] \
  [--manufacturer panini] \
  [--headed] \
  [--dry-run]
```

**Exit codes:** `0` success, `1` partial discovery errors, `2` fatal (page unreachable).

---

#### `run`

Full pipeline: discover (optional skip) → download → compile → manifest.

```bash
pnpm checklist-harvest run \
  [--skip-discover] \
  [--brand <label>] \
  [--year <label>] \
  [--force] \
  [--strict] \
  [--resume <run_id>] \
  [--headed]
```

| Flag | Behavior |
|------|----------|
| `--skip-discover` | Use existing catalog on disk |
| `--brand Mosaic` | Filter catalog to matching brand (case-insensitive) |
| `--year 2024` | Filter catalog to matching year |
| `--force` | Re-download even if checksum matches |
| `--strict` | Exit non-zero if any catalog entry fails download |
| `--resume <run_id>` | Retry failed downloads from prior run; skip successful |
| `--headed` | Playwright visible browser |

**Pipeline steps:**

1. Create `run_id` = `YYYYMMDD-HHmmss-{shortuuid}`.
2. Discover (unless skipped) → write catalog.
3. Download all matching catalog entries → `staging/raw/`.
4. Compile per brand → `staging/runs/{run_id}/compiled/`.
5. Write `staging/runs/{run_id}/manifest.json`.
6. Print summary table to stdout.

---

#### `download`

Download only (no compile).

```bash
pnpm checklist-harvest download [--brand <label>] [--force] [--resume <run_id>]
```

---

#### `compile`

Compile from existing raw files (no network).

```bash
pnpm checklist-harvest compile \
  --run <run_id> \
  [--brand <label>]
```

---

#### `status`

Show run summary.

```bash
pnpm checklist-harvest status [--run <run_id>] [--latest]
```

---

#### `approve`

Promote compiled files from a run to `approved/`.

```bash
pnpm checklist-harvest approve \
  --run <run_id> \
  [--brand <label>] \
  [--all]
```

| Flag | Behavior |
|------|----------|
| `--brand Mosaic` | Approve single brand compiled file |
| `--all` | Approve all compiled files from run |
| (neither) | Interactive prompt listing brands |

**Approve side effects:**

1. Copy `staging/runs/{run_id}/compiled/panini/basketball/{brand_slug}.csv`  
   → `approved/panini/basketball/{brand_slug}.csv`
2. Append entry to `approved/manifest.json` (append-only audit log).
3. Do **not** delete staging (retain for audit).

---

## 4. Storage layout

### 4.1 Local filesystem (`--storage local`)

```
{root}/
├── catalog/
│   └── panini-basketball.json
├── staging/
│   ├── raw/
│   │   └── panini/basketball/{catalog_id}/{iso_timestamp}.csv
│   └── runs/
│       └── {run_id}/
│           ├── manifest.json
│           └── compiled/
│               └── panini/basketball/{brand_slug}.csv
└── approved/
    ├── manifest.json
    └── panini/basketball/{brand_slug}.csv
```

### 4.2 Supabase Storage (`--storage supabase`)

**Bucket:** `checklist-harvest` (create via migration or dashboard)

Same path structure as local, rooted at bucket root:

```
checklist-harvest/staging/runs/{run_id}/compiled/panini/basketball/mosaic.csv
checklist-harvest/approved/panini/basketball/mosaic.csv
checklist-harvest/catalog/panini-basketball.json
```

**Auth:** CLI uses `SUPABASE_SERVICE_ROLE_KEY` (never commit). Read/write only to `checklist-harvest` bucket.

**Migration stub** (future `046_checklist_harvest_bucket.sql`):

```sql
-- Private bucket; service role writes; authenticated admins read (optional V1.1)
insert into storage.buckets (id, name, public)
values ('checklist-harvest', 'checklist-harvest', false)
on conflict (id) do nothing;
```

---

## 5. Catalog schema

**File:** `catalog/panini-basketball.json`

```typescript
interface ChecklistCatalog {
  version: 1;
  manufacturer: "panini";
  sport: "basketball";
  source_url: "https://www.paniniamerica.net/checklist.html";
  discoverer_version: string;       // e.g. "panini-basketball-v1"
  last_discovered_at: string;       // ISO8601
  entries: ChecklistCatalogEntry[];
}

interface ChecklistCatalogEntry {
  /** Stable id: panini-basketball-{year_slug}-{brand_slug}-{set_slug} */
  id: string;

  manufacturer: "panini";
  sport: "basketball";

  /** Exact label from Panini brand/program dropdown */
  brand: string;
  brand_slug: string;

  /** Exact label from year dropdown */
  year: string;

  /** Exact label from set/checklist dropdown */
  set_label: string;
  set_slug: string;

  /** Resolved at discovery time */
  download_url: string | null;

  file_type: "csv";

  /** Discovery + download lifecycle */
  status: "pending" | "downloaded" | "failed" | "deprecated";

  discovered_at: string;
  last_attempt_at: string | null;
  last_success_at: string | null;

  /** sha256 of raw file bytes */
  checksum: string | null;

  /** Relative path under staging/raw/ for latest successful download */
  raw_path: string | null;

  error: string | null;

  /** Dropdown indices or breadcrumb for replay/debug */
  discovery_meta?: {
    sport_index?: number;
    year_index?: number;
    brand_index?: number;
    set_index?: number;
    page_title?: string;
  };
}
```

### ID generation

```typescript
function buildCatalogId(entry: {
  year: string;
  brand: string;
  set_label: string;
}): string {
  return [
    "panini",
    "basketball",
    slugify(entry.year),
    slugify(entry.brand),
    slugify(entry.set_label),
  ].join("-");
}
```

`slugify`: lowercase, replace non-alphanumeric with `-`, collapse repeats, max 80 chars per segment.

### Catalog merge on re-discover

- Match existing entries by `id`.
- New entries: `status: pending`.
- Missing from site (no longer in dropdown enumeration): set `status: deprecated` (do not delete).
- Preserve `checksum`, `raw_path`, `last_success_at` on existing entries unless `--force-discover-reset`.

---

## 6. Run manifest schema

**File:** `staging/runs/{run_id}/manifest.json`

```typescript
interface RunManifest {
  version: 1;
  run_id: string;
  manufacturer: "panini";
  sport: "basketball";

  started_at: string;
  finished_at: string | null;
  status: "running" | "completed" | "failed" | "partial";

  cli_args: Record<string, string | boolean>;

  discovery: {
    skipped: boolean;
    entries_total: number;
    entries_new: number;
    entries_deprecated: number;
  };

  download: {
    attempted: number;
    succeeded: number;
    skipped_checksum: number;
    failed: number;
    failures: Array<{ catalog_id: string; error: string }>;
  };

  compile: {
    brands: Array<{
      brand: string;
      brand_slug: string;
      output_path: string;
      source_count: number;
      row_count: number;
      columns: string[];
      source_ids: string[];
    }>;
  };

  warnings: string[];
}
```

---

## 7. Panini discoverer algorithm

**Module:** `discoverers/panini-basketball.ts`  
**Engine:** Playwright Chromium  
**Target:** `https://www.paniniamerica.net/checklist.html`

### 7.1 Preconditions

- Launch browser with realistic viewport (1280×720).
- Set User-Agent: `CollectorApp-ChecklistHarvest/1.0 (+internal research)`.
- Default timeout: 30s per navigation; 10s per dropdown interaction.

### 7.2 Discovery flow (pseudocode)

```
1. page.goto(CHECKLIST_URL, waitUntil: networkidle)

2. Locate sport dropdown (config selector: SELECTORS.sport)
   - Verify "Basketball" option exists
   - selectOption("Basketball")
   - waitForNetworkIdle()

3. Read all year options from year dropdown (SELECTORS.year)
   FOR each yearOption:

4.   selectOption(year dropdown, yearOption)
     waitForNetworkIdle()

5.   Read all brand options (SELECTORS.brand)
     FOR each brandOption:

6.     selectOption(brand dropdown, brandOption)
       waitForNetworkIdle()

7.     Read all set options (SELECTORS.set)
       FOR each setOption:

8.       selectOption(set dropdown, setOption)
         waitForNetworkIdle()

9.       Resolve download:
           a) Look for <a> or button with href/text matching /csv|download/i
           b) If href is direct URL → record download_url
           c) If click triggers download → intercept via page.waitForEvent('download')
              - Do NOT save file during discover; only capture suggested filename + URL if available
           d) If no CSV link → record download_url: null, status: pending, warning

10.      Build ChecklistCatalogEntry, push to entries[]

11. Rate limit: sleep(500ms) between leaf iterations

12. Return entries[]
```

### 7.3 Selector strategy

**Config file** `config/panini-basketball.ts` exports selectors with fallbacks:

```typescript
export const PANINI_CHECKLIST = {
  url: "https://www.paniniamerica.net/checklist.html",
  selectors: {
    sport: ['select#sport', 'select[name*="sport" i]', '[data-testid="sport-select"]'],
    year: ['select#year', 'select[name*="year" i]'],
    brand: ['select#brand', 'select[name*="brand" i]', 'select[name*="program" i]'],
    set: ['select#set', 'select[name*="set" i]', 'select[name*="checklist" i]'],
    downloadLink: [
      'a[href*=".csv" i]',
      'a:has-text("CSV")',
      'button:has-text("CSV")',
      'a:has-text("Download")',
    ],
  },
  rateLimitMs: 500,
};
```

**Implementation note:** First implementation pass must **record actual DOM selectors** from a headed run and commit working values. Discovery module reads selectors from config only — no hardcoded CSS in logic.

### 7.4 Discovery-only vs download

| Phase | Browser action |
|-------|----------------|
| `discover` | Enumerate dropdowns; capture URLs where possible; may use `download` event to learn URL pattern |
| `download` | Re-play catalog entry via URL or re-select dropdown path from `discovery_meta` |

**Preferred download path:** Direct `download_url` via HTTP GET if stable. **Fallback:** Playwright replay of dropdown indices from `discovery_meta`.

---

## 8. Download module

**Module:** `download/csv-downloader.ts`

```typescript
interface DownloadResult {
  catalog_id: string;
  success: boolean;
  raw_path: string | null;
  checksum: string | null;
  byte_length: number;
  error?: string;
}

async function downloadEntry(
  entry: ChecklistCatalogEntry,
  storage: StorageAdapter,
  options: { force: boolean }
): Promise<DownloadResult>;
```

### Algorithm

```
1. If entry.checksum && !options.force:
     if raw file exists at entry.raw_path → return skipped (success)

2. If entry.download_url:
     GET with fetch (same User-Agent)
   Else:
     Playwright replay from discovery_meta

3. Validate:
     - Content-Type or extension suggests CSV
     - Size < 50 MB
     - Parse first line as CSV header (at least 1 column)

4. checksum = sha256(bytes)
   path = staging/raw/panini/basketball/{catalog_id}/{timestamp}.csv
   storage.write(path, bytes)

5. Update catalog entry:
     status: downloaded
     checksum, raw_path, last_success_at

6. On failure:
     status: failed
     error message
     increment attempt count
```

### Rate limiting

- Max **1 concurrent** Panini download.
- Min **500ms** between requests (configurable).

---

## 9. Brand compiler

**Module:** `compile/brand-compiler.ts`

### 9.1 Grouping

```typescript
function groupByBrand(
  entries: ChecklistCatalogEntry[]
): Map<string, ChecklistCatalogEntry[]> {
  // key = brand_slug
  // only entries with status === "downloaded" && raw_path
}
```

### 9.2 Column union merge

**Module:** `compile/column-union.ts`

```
Input: ordered list of raw CSV paths for one brand

1. columns: string[] = []
2. rows: Record<string, string>[] = []

3. FOR each raw file in order (year asc, set_label asc):
     parse CSV with header row
     FOR each new header not in columns:
       append to columns
     FOR each data row:
       map row to Record keyed by its headers
       build full row with empty string for missing columns
       append provenance fields (§9.3)
       push to rows

4. Write CSV:
     header = [...original_columns_in_union_order, ...PROVENANCE_COLUMNS]
     stringify rows
```

### 9.3 Provenance columns (appended last)

```typescript
const PROVENANCE_COLUMNS = [
  "_harvest_source_id",
  "_harvest_source_url",
  "_harvest_brand",
  "_harvest_sport",
  "_harvest_year",
  "_harvest_set_label",
  "_harvest_downloaded_at",
] as const;
```

Values:

| Column | Source |
|--------|--------|
| `_harvest_source_id` | `entry.id` |
| `_harvest_source_url` | `entry.download_url ?? ""` |
| `_harvest_brand` | `entry.brand` |
| `_harvest_sport` | `"basketball"` |
| `_harvest_year` | `entry.year` |
| `_harvest_set_label` | `entry.set_label` |
| `_harvest_downloaded_at` | from raw file metadata or catalog `last_success_at` |

### 9.4 Output

```
staging/runs/{run_id}/compiled/panini/basketball/{brand_slug}.csv
```

One file per distinct `brand_slug` in catalog for basketball.

---

## 10. Storage adapter interface

```typescript
interface StorageAdapter {
  read(path: string): Promise<Buffer>;
  write(path: string, data: Buffer | string): Promise<void>;
  exists(path: string): Promise<boolean>;
  copy(src: string, dest: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
```

| Implementation | When |
|----------------|------|
| `LocalStorageAdapter` | Default dev; root = `./data/checklist-harvest` |
| `SupabaseStorageAdapter` | `--storage supabase`; bucket `checklist-harvest` |

---

## 11. Approved manifest (audit log)

**File:** `approved/manifest.json`

```typescript
interface ApprovedManifest {
  version: 1;
  approvals: Array<{
    approved_at: string;
    approved_by: string;          // OS user or SUPABASE_USER env
    run_id: string;
    brand: string;
    brand_slug: string;
    source_path: string;
    approved_path: string;
    row_count: number;
    checksum: string;             // sha256 of approved file
  }>;
}
```

Append on each `approve` action.

---

## 12. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CHECKLIST_HARVEST_STORAGE` | No | `local` \| `supabase` |
| `CHECKLIST_HARVEST_ROOT` | No | Local root path |
| `SUPABASE_URL` | If supabase | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | If supabase | Storage writes |
| `CHECKLIST_HARVEST_APPROVED_BY` | No | Audit log identity (default: `$USER`) |

---

## 13. Error handling & resume

| Failure | Behavior |
|---------|----------|
| Single download fails | Log in manifest; continue unless `--strict` |
| Discovery selector not found | Fatal; exit 2; print "update selectors in config" |
| Compile: zero rows for brand | Warning in manifest; skip output file |
| Compile: column parse error | Fail that source; warning; continue other sources |
| Mid-run crash | Re-run with `--resume {run_id}` — skip downloaded checksums |

**Resume logic:**

- Load manifest for `run_id`.
- Download: only entries where `status !== downloaded` or `--force`.
- Compile: rebuild from all `downloaded` entries (idempotent).

---

## 14. Logging

Structured log event shape:

```typescript
interface LogEvent {
  ts: string;
  level: "info" | "warn" | "error" | "debug";
  event: string;           // e.g. "download.complete"
  run_id?: string;
  catalog_id?: string;
  brand?: string;
  message?: string;
  meta?: Record<string, unknown>;
}
```

Human default: pretty console. `--json-logs`: one JSON object per line.

---

## 15. Security & operations

- Service role key only in local `.env` / CI secrets — never in repo.
- Bucket `checklist-harvest` is **private**.
- Playwright runs in sandbox; no arbitrary URL fetch except Panini domain + resolved `download_url` hosts (validate host allowlist: `*.paniniamerica.net`, `*.panini.com`).
- Raw CSVs may contain large files; stream writes where possible.

---

## 16. GitHub Actions (optional)

**File:** `.github/workflows/checklist-harvest.yml`

```yaml
on:
  workflow_dispatch:
    inputs:
      brand:
        description: "Optional brand filter"
        required: false

jobs:
  harvest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx playwright install chromium
      - run: pnpm checklist-harvest run --storage supabase
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

Approval remains **manual** — workflow does not auto-promote to `approved/`.

---

## 17. Implementation order

| Step | Deliverable | Verification |
|------|-------------|--------------|
| **1** | Storage adapters + catalog store | Unit test read/write roundtrip |
| **2** | Slug/checksum utils | Unit tests |
| **3** | Playwright discoverer (headed) | `discover` → catalog with ≥1 entry |
| **4** | Record working selectors in config | Commit `config/panini-basketball.ts` |
| **5** | HTTP downloader | Download 1 known CSV |
| **6** | Column union compiler | Merge 2 fixture CSVs |
| **7** | `run` command end-to-end | Full run on 2–3 sets |
| **8** | `approve` command | File appears in `approved/` |
| **9** | Supabase storage adapter | Upload to bucket |
| **10** | Full Panini Basketball run | Manifest review; manual AI Loader test |

---

## 18. Test plan

### 18.1 Unit tests

| Module | Cases |
|--------|-------|
| `slug.ts` | Special chars, length limit, collision |
| `column-union.ts` | Disjoint headers, overlapping headers, empty file |
| `brand-compiler.ts` | Grouping, provenance columns, sort order |
| `catalog-store.ts` | Merge, deprecate, id stability |

### 18.2 Integration tests

| Test | Method |
|------|--------|
| Discover smoke | Mock HTML fixture page with 3 dropdowns |
| Download | WireMock HTTP server returning sample CSV |
| Full pipeline | Recorded Playwright trace against live site (optional nightly) |

### 18.3 Fixture data

```
scripts/checklist-harvest/__fixtures__/
├── panini-checklist-page.html      # saved DOM snapshot
├── mosaic-2024-sample.csv
├── prizm-2023-sample.csv
└── expected-mosaic-compiled.csv
```

### 18.4 Acceptance (V1 done)

- [ ] `discover` finds all Basketball entries on live Panini site
- [ ] `run` downloads ≥90% of catalog (remainder documented in manifest)
- [ ] Compiled files exist per brand under `staging/runs/{run_id}/compiled/`
- [ ] Human runs `approve --all`
- [ ] Approved `mosaic.csv` (or similar) uploads to AI Loader successfully

---

## 19. Extension points (V2+)

| Extension | Interface |
|-----------|-----------|
| Topps PDF | `discoverers/topps-*.ts` + `parsers/pdf-table.ts` |
| New manufacturer | New discoverer implementing `IDiscoverer` |
| Scheduled runs | External cron → `pnpm checklist-harvest run` |
| Admin UI | Calls same CLI or imports `run()` programmatically |
| AI Loader auto-upload | Post-approve hook reading `approved/manifest.json` |

```typescript
interface IDiscoverer {
  readonly id: string;
  discover(options: DiscoverOptions): Promise<ChecklistCatalogEntry[]>;
}
```

---

## 20. Open implementation tasks (pre-coding)

1. **Headed Playwright session** — load Panini checklist page; capture real dropdown selectors; update `config/panini-basketball.ts`.
2. **Confirm download mechanism** — direct URL vs click-to-download; document in config.
3. **Create Supabase bucket** — `checklist-harvest` (migration or dashboard).
4. **Add gitignore entry** — `data/checklist-harvest/`.

---

## 21. Summary

| Area | Decision |
|------|----------|
| Runtime | Node.js CLI + Playwright |
| V1 source | Panini Basketball CSV only |
| Grouping | One compiled CSV per brand per sport |
| Columns | Native union + `_harvest_*` provenance |
| Workflow | On-demand → staging → human `approve` → approved |
| Storage | Local dev + Supabase Storage production |
| UI | None V1 |
| Next step | Step 1–4 from §17, starting with headed selector capture |
