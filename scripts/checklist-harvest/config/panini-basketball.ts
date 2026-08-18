/**
 * Panini Basketball checklist page configuration.
 * Selectors captured via probe-panini-deep.ts (2026-08-06).
 *
 * Page uses Bootstrap 5 custom dropdown buttons (not native <select>).
 * Hierarchy: Sport â†’ Year â†’ Brand â†’ Program (mapped to set in catalog).
 */
export const PANINI_CHECKLIST = {
  url: "https://www.paniniamerica.net/checklist.html",
  sport: "Basketball",
  userAgent: "CollectorApp-ChecklistHarvest/1.0 (+internal research)",
  viewport: { width: 1280, height: 720 },
  navigationTimeoutMs: 90_000,
  interactionTimeoutMs: 10_000,
  /** Delay between browser dropdown selections */
  rateLimitMs: 200,
  /** Delay between direct Node API calls */
  apiRateLimitMs: 150,
  /** Brief settle after incremental dropdown navigation */
  dropdownSettleMs: 200,
  allowedDownloadHosts: ["paniniamerica.net", "panini.com"],
  selectors: {
    /** Bootstrap 5 dropdown trigger buttons (data-bs-toggle="dropdown") */
    sport: ["#close-dropdown-activity_type"],
    year: ["#close-dropdown-year_type"],
    brand: ["#close-dropdown-brand_type"],
    /** Panini labels this "Program" in UI; maps to set_label in catalog */
    set: ["#close-dropdown-program_type"],
    /** Options inside open menu â€” use aria-label when present */
    dropdownMenu: [".dropdown-menu.show", ".dropdown-menu"],
    dropdownItem: [".dropdown-item"],
    /** Loader to wait for SPA */
    initialLoader: ["#initial-loader"],
    root: ["#root"],
    /** Modals that block interaction */
    infoModal: ["#informationAlert", ".modal.show"],
    modalDismiss: [
      "button.btn-primary",
      'button:has-text("OK")',
      'button:has-text("Close")',
      'button:has-text("Got it")',
      'button:has-text("Continue")',
      ".btn-close",
      "button.close",
    ],
    cookieAccept: ['button:has-text("ACCEPT ALL")', 'button:has-text("Accept All")'],
    downloadButton: [
      'button[aria-label="Download Full Checklist"]',
      'button:has-text("DOWNLOAD full CHECKLIST")',
    ],
    downloadLink: [
      'button[aria-label="Download Full Checklist"]',
      'button:has-text("DOWNLOAD full CHECKLIST")',
      'a[href*=".csv" i]',
      'a:has-text("CSV")',
      'button:has-text("CSV")',
      'a[download*=".csv" i]',
    ],
  },
  discovererVersion: "panini-basketball-v1",
} as const;

export type PaniniChecklistConfig = typeof PANINI_CHECKLIST;
