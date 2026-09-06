export type ResearchWatchlistKind = "market" | "player" | "card";

export interface ResearchWatchlistItem {
  kind: ResearchWatchlistKind;
  id: string;
  label: string;
  href: string;
}

const STORAGE_KEY = "collector.market-research.watchlist";
const EVENT_NAME = "collector-watchlist-change";

function readItems(): ResearchWatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ResearchWatchlistItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeItems(items: ResearchWatchlistItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function isOnResearchWatchlist(
  kind: ResearchWatchlistKind,
  id: string
): boolean {
  return readItems().some((item) => item.kind === kind && item.id === id);
}

export function toggleResearchWatchlist(item: ResearchWatchlistItem): boolean {
  const items = readItems();
  const exists = items.some(
    (entry) => entry.kind === item.kind && entry.id === item.id
  );
  writeItems(
    exists
      ? items.filter((entry) => !(entry.kind === item.kind && entry.id === item.id))
      : [...items, item]
  );
  return !exists;
}

export function subscribeResearchWatchlist(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}
