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

export type CardStatus = "held" | "sold";

export interface Card {
  id: string;
  user_id: string;
  player_name: string;
  year: number;
  card_type: string;
  sport: Sport;
  card_number: string | null;
  insert_parallel: string | null;
  grader: Grader;
  grade: string | null;
  cert_number: string | null;
  purchase_date: string;
  purchase_price: number;
  quantity: number;
  image_path: string | null;
  notes: string | null;
  status: CardStatus;
  sold_at: string | null;
  sold_price: number | null;
  created_at: string;
  updated_at: string;
}

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
  quantity: number;
  notes: string;
  current_value: string;
}

export interface CardValuation {
  id: string;
  card_id: string;
  user_id: string;
  value: number;
  recorded_at: string;
  created_at: string;
}

export interface CardPerformance {
  card: Card;
  costBasis: number;
  currentValue: number;
  gainAmount: number;
  gainPercent: number;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function cardCostBasis(card: Card): number {
  return Number(card.purchase_price) * Number(card.quantity);
}

export function isCardHeld(card: Card): boolean {
  return card.status !== "sold";
}

export function cardSaleProceeds(card: Card): number | null {
  if (card.sold_price == null) return null;
  return card.sold_price * card.quantity;
}

export function cardWasHeldAt(card: Card, asOf: Date): boolean {
  if (card.status !== "sold" || !card.sold_at) return true;
  return new Date(`${card.sold_at}T23:59:59`) > asOf;
}

export function cardMarketValue(
  unitValue: number,
  quantity: number
): number {
  return Number(unitValue) * Number(quantity);
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

export function gradeLabel(card: Pick<Card, "grader" | "grade" | "cert_number">): string {
  if (card.grader === "Raw" || card.grader === "Ungraded") {
    return card.grader;
  }
  const parts = [card.grader, card.grade].filter(Boolean);
  if (card.cert_number) {
    parts.push(`#${card.cert_number}`);
  }
  return parts.join(" ");
}

export function cardTitle(card: Pick<Card, "year" | "card_type" | "player_name">): string {
  return `${card.year} ${card.card_type} ${card.player_name}`;
}
