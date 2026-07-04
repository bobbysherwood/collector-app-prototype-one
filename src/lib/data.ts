import { createClient } from "@/lib/supabase/server";
import type { Card, CardValuation, CardPerformance } from "@/types/card";
import { cardCostBasis, cardMarketValue, isCardHeld, percentChange } from "@/types/card";
import { buildLatestValuationMap } from "@/lib/valuations";
import type { CardSale } from "@/lib/portfolio-history";

export async function getPortfolioChartData() {
  const [cards, valuations] = await Promise.all([
    getCards(),
    getAllValuations(),
  ]);

  const heldCards = cards.filter(isCardHeld);
  const performance = buildCardPerformanceLeaders(heldCards, valuations);

  return { cards, heldCards, valuations, ...performance };
}

export function buildCardPerformanceLeaders(
  heldCards: Card[],
  valuations: CardValuation[],
  limit = 10
): {
  topPerformers: CardPerformance[];
  underperformers: CardPerformance[];
} {
  const latestValuations = buildLatestValuationMap(valuations);
  const performances: CardPerformance[] = [];

  for (const card of heldCards) {
    const latest = latestValuations.get(card.id);
    if (!latest) continue;

    const costBasis = cardCostBasis(card);
    const currentValue = cardMarketValue(latest.value, card.quantity);
    const gainPercent = percentChange(costBasis, currentValue);
    if (gainPercent == null || Number.isNaN(gainPercent)) continue;

    performances.push({
      card,
      costBasis,
      currentValue,
      gainAmount: currentValue - costBasis,
      gainPercent,
    });
  }

  const topPerformers = [...performances]
    .sort((a, b) => b.gainPercent - a.gainPercent)
    .slice(0, limit);

  const underperformers = [...performances]
    .sort((a, b) => a.gainPercent - b.gainPercent)
    .slice(0, limit);

  return { topPerformers, underperformers };
}

export async function getAllSales(): Promise<CardSale[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_sales")
    .select("*")
    .order("sale_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CardSale[];
}

export async function getCards(): Promise<Card[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((card) => ({
    ...card,
    status: card.status ?? "held",
    sold_at: card.sold_at ?? null,
    sold_price: card.sold_price ?? null,
  })) as Card[];
}

export async function getCard(id: string): Promise<Card | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return {
    ...data,
    status: data.status ?? "held",
    sold_at: data.sold_at ?? null,
    sold_price: data.sold_price ?? null,
  } as Card;
}

export async function getAllValuations(): Promise<CardValuation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_valuations")
    .select("*")
    .order("recorded_at", { ascending: false });

  if (error) throw error;
  return data as CardValuation[];
}

export async function getCardValuations(
  cardId: string
): Promise<CardValuation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_valuations")
    .select("*")
    .eq("card_id", cardId)
    .order("recorded_at", { ascending: true });

  if (error) throw error;
  return data as CardValuation[];
}

export async function getLatestValuationMap(): Promise<
  Map<string, CardValuation>
> {
  const valuations = await getAllValuations();
  return buildLatestValuationMap(valuations);
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile:", error.message);
  }

  const displayName =
    profile?.display_name?.trim() ||
    (user.user_metadata?.display_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Account";

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    displayName,
  };
}
