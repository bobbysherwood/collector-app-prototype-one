# Checklist Harvest Agent — V1 Requirements (Locked)

**Date:** 2026-08-06  
**Status:** Approved  
**Implementation spec:** [checklist-harvest-v1-implementation-spec.md](./checklist-harvest-v1-implementation-spec.md)

## Scope

- **V1 source:** Panini America ([checklist.html](https://www.paniniamerica.net/checklist.html)) — Basketball only
- **Format:** CSV as provided by Panini
- **Output:** One compiled CSV per **brand per sport** (native columns + `_harvest_*` provenance)
- **CARD SET / metadata:** Raw — AI Loader handles interpretation
- **Years/sets:** All available on the Panini site
- **Workflow:** On-demand run → staging → **human approval** → approved folder → manual AI Loader upload
- **No UI in V1**

## Out of scope (V1)

- Topps (PDF) — V2
- Other manufacturers
- Scheduled/cron runs
- Manufacturer/brand normalization, dedup, row quality — AI Loader
- Admin UI

## Decisions

| Topic | Decision |
|-------|----------|
| Brand grouping | Panini UI product line (Mosaic, Prizm, etc.) |
| Sports | Never mixed in one file |
| Output | CSV; column union from sources |
| Approval | Required before use |
| Storage | Supabase Storage + local dev mirror (see implementation spec) |
| Runtime | CLI + Playwright (on-demand) |

## Sources (future)

| Source | Format | Version |
|--------|--------|---------|
| Panini | CSV | V1 |
| Topps | PDF | V2 |
| Other | TBD | Future |
