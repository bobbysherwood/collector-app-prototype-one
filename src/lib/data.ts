import { createClient } from "@/lib/supabase/server";
import type {
  Asset,
  CardValuation,
  LotPerformance,
  Lot,
  CardSale,
} from "@/types/card";
import {
  buildAssetPositions,
  buildHeldLotPositions,
  costBasisHeld,
  isAssetHeld,
  quantityHeld,
  type AssetPosition,
  type HeldLotPosition,
} from "@/types/card";
import { positionMarketValue, percentChange } from "@/types/card";
import { buildLatestValuationMap } from "@/lib/valuations";

export type { AssetPosition, HeldLotPosition };

export interface PortfolioData {
  assets: Asset[];
  lots: Lot[];
  sales: CardSale[];
  valuations: CardValuation[];
  positions: AssetPosition[];
  heldLotPositions: HeldLotPosition[];
}

export async function getPortfolioData(): Promise<PortfolioData> {
  const [assets, lots, sales, valuations] = await Promise.all([
    getAssets(),
    getLots(),
    getAllSales(),
    getAllValuations(),
  ]);

  return {
    assets,
    lots,
    sales,
    valuations,
    positions: buildAssetPositions(assets, lots),
    heldLotPositions: buildHeldLotPositions(assets, lots),
  };
}

export async function getPortfolioChartData() {
  const data = await getPortfolioData();
  const heldLotPositions = data.heldLotPositions;
  const performance = buildLotPerformanceLeaders(
    heldLotPositions,
    data.valuations
  );

  return {
    ...data,
    heldLotPositions,
    heldPositions: data.positions.filter((p) => isAssetHeld(p.lots)),
    ...performance,
  };
}

export function buildLotPerformanceLeaders(
  heldLotPositions: HeldLotPosition[],
  valuations: CardValuation[],
  limit = 10
): {
  topPerformers: LotPerformance[];
  underperformers: LotPerformance[];
} {
  const latestValuations = buildLatestValuationMap(valuations);
  const performances: LotPerformance[] = [];

  for (const { asset, lot } of heldLotPositions) {
    const latest = latestValuations.get(lot.id);
    if (!latest) continue;

    const qty = lot.quantity_remaining;
    const costBasis = lot.unit_cost * qty;
    const currentValue = positionMarketValue(latest.value, qty);
    const gainPercent = percentChange(costBasis, currentValue);
    if (gainPercent == null || Number.isNaN(gainPercent)) continue;

    performances.push({
      asset,
      lot,
      costBasis,
      currentValue,
      gainAmount: currentValue - costBasis,
      gainPercent,
    });
  }

  const topPerformers = [...performances]
    .filter((p) => p.gainPercent > 0)
    .sort((a, b) => b.gainPercent - a.gainPercent)
    .slice(0, limit);

  const underperformers = [...performances]
    .filter((p) => p.gainPercent < 0)
    .sort((a, b) => a.gainPercent - b.gainPercent)
    .slice(0, limit);

  return { topPerformers, underperformers };
}

/** @deprecated Use buildLotPerformanceLeaders */
export const buildAssetPerformanceLeaders = buildLotPerformanceLeaders;

/** @deprecated Use buildLotPerformanceLeaders */
export const buildCardPerformanceLeaders = buildLotPerformanceLeaders;

export async function getAllSales(): Promise<CardSale[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_sales")
    .select("*")
    .order("sale_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CardSale[];
}

export async function getAssets(): Promise<Asset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Asset[];
}

/** @deprecated Use getAssets */
export const getCards = getAssets;

export async function getLots(): Promise<Lot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lots")
    .select("*")
    .order("purchase_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Lot[];
}

export async function getAsset(id: string): Promise<Asset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Asset;
}

/** @deprecated Use getAsset */
export const getCard = getAsset;

export async function getLotsForAsset(assetId: string): Promise<Lot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lots")
    .select("*")
    .eq("asset_id", assetId)
    .order("purchase_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Lot[];
}

export async function getSalesForAsset(assetId: string): Promise<CardSale[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_sales")
    .select("*")
    .eq("asset_id", assetId)
    .order("sale_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CardSale[];
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

export async function getValuationsForAsset(
  assetId: string
): Promise<CardValuation[]> {
  const lots = await getLotsForAsset(assetId);
  if (lots.length === 0) return [];

  const lotIds = lots.map((l) => l.id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_valuations")
    .select("*")
    .in("lot_id", lotIds)
    .order("recorded_at", { ascending: true });

  if (error) throw error;
  return data as CardValuation[];
}

export async function getLotValuations(
  lotId: string
): Promise<CardValuation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_valuations")
    .select("*")
    .eq("lot_id", lotId)
    .order("recorded_at", { ascending: true });

  if (error) throw error;
  return data as CardValuation[];
}

/** @deprecated Use getValuationsForAsset */
export const getAssetValuations = getValuationsForAsset;

/** @deprecated Use getValuationsForAsset */
export const getCardValuations = getValuationsForAsset;

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

export {
  salesForAsset,
  totalSaleProceeds,
  totalSoldQuantity,
} from "@/lib/inventory";
