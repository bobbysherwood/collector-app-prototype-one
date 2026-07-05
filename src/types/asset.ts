export type Grader =
  | "PSA"
  | "BGS"
  | "SGC"
  | "CGC"
  | "Raw"
  | "Ungraded";

export type Sport =
  | "Baseball"
  | "Basketball"
  | "Football"
  | "Hockey"
  | "Pokemon"
  | "Soccer"
  | "Other";

/** Card identity — purchase, sale, and grading live on lots. */
export interface Asset {
  id: string;
  user_id: string;
  player_name: string;
  year: number;
  card_type: string;
  sport: Sport;
  card_number: string | null;
  insert_parallel: string | null;
  image_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** One purchase / acquisition event for an asset (includes grading). */
export interface Lot {
  id: string;
  asset_id: string;
  user_id: string;
  purchase_date: string;
  unit_cost: number;
  quantity_acquired: number;
  quantity_remaining: number;
  grader: Grader;
  grade: string | null;
  cert_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface CardSale {
  id: string;
  asset_id: string | null;
  card_id: string | null;
  user_id: string;
  sale_date: string;
  sale_price: number;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface SaleLotAllocation {
  id: string;
  sale_id: string;
  lot_id: string;
  quantity: number;
  unit_cost: number;
  created_at: string;
}

export interface CardValuation {
  id: string;
  lot_id: string;
  user_id: string;
  value: number;
  recorded_at: string;
  created_at: string;
}

/** @deprecated Use Asset — kept as alias during transition */
export type Card = Asset;

export interface CardFormData {
  player_name: string;
  year: number;
  card_type: string;
  sport: Sport;
  card_number: string;
  insert_parallel: string;
  grader: Grader;
  grade: string;
  cert_number: string;
  purchase_date: string;
  purchase_price: number;
  notes: string;
  current_value: string;
}

export interface LotPerformance {
  asset: Asset;
  lot: Lot;
  costBasis: number;
  currentValue: number;
  gainAmount: number;
  gainPercent: number;
}

/** @deprecated Use LotPerformance */
export type AssetPerformance = LotPerformance;

/** @deprecated Use LotPerformance */
export type CardPerformance = LotPerformance;

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function gradeLabel(
  lot: Pick<Lot, "grader" | "grade" | "cert_number">
): string {
  if (lot.grader === "Raw" || lot.grader === "Ungraded") {
    return lot.grader;
  }
  const parts = [lot.grader, lot.grade].filter(Boolean);
  if (lot.cert_number) {
    parts.push(`#${lot.cert_number}`);
  }
  return parts.join(" ");
}

export function cardTitle(
  asset: Pick<Asset, "year" | "card_type" | "player_name">
): string {
  return `${asset.year} ${asset.card_type} ${asset.player_name}`;
}

export function positionMarketValue(
  unitValue: number,
  quantity: number
): number {
  return Number(unitValue) * Number(quantity);
}

/** @deprecated */
export const cardMarketValue = positionMarketValue;
