import type { Asset, CardSale, Lot } from "@/types/asset";
import { cardTitle } from "@/types/asset";

/** Total units still held across all open lots. */
export function quantityHeld(lots: Lot[]): number {
  return lots.reduce((sum, lot) => sum + lot.quantity_remaining, 0);
}

/** Cost basis of remaining inventory (FIFO lots at their unit costs). */
export function costBasisHeld(lots: Lot[]): number {
  return lots.reduce(
    (sum, lot) => sum + lot.unit_cost * lot.quantity_remaining,
    0
  );
}

export function isAssetHeld(lots: Lot[]): boolean {
  return quantityHeld(lots) > 0;
}

/** Weighted average unit cost of remaining inventory. */
export function averageUnitCostHeld(lots: Lot[]): number {
  const qty = quantityHeld(lots);
  if (qty === 0) return 0;
  return costBasisHeld(lots) / qty;
}

export function earliestPurchaseDate(lots: Lot[]): string | null {
  if (lots.length === 0) return null;
  return lots.reduce(
    (earliest, lot) => (lot.purchase_date < earliest ? lot.purchase_date : earliest),
    lots[0].purchase_date
  );
}

export interface FifoAllocation {
  lotId: string;
  quantity: number;
  unitCost: number;
}

/**
 * Allocate quantity from lots using FIFO (oldest purchase_date first, then created_at).
 * Returns allocations and updated remaining quantities (in-memory only).
 */
export function fifoAllocate(
  lots: Lot[],
  quantityToSell: number
): { allocations: FifoAllocation[]; error?: string } {
  if (quantityToSell <= 0 || !Number.isInteger(quantityToSell)) {
    return { allocations: [], error: "Quantity must be a positive whole number." };
  }

  const available = quantityHeld(lots);
  if (quantityToSell > available) {
    return {
      allocations: [],
      error: `Only ${available} unit${available === 1 ? "" : "s"} available to sell.`,
    };
  }

  const openLots = [...lots]
    .filter((l) => l.quantity_remaining > 0)
    .sort((a, b) => {
      const dateCmp = a.purchase_date.localeCompare(b.purchase_date);
      if (dateCmp !== 0) return dateCmp;
      return a.created_at.localeCompare(b.created_at);
    });

  const allocations: FifoAllocation[] = [];
  let remaining = quantityToSell;

  for (const lot of openLots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity_remaining, remaining);
    allocations.push({
      lotId: lot.id,
      quantity: take,
      unitCost: lot.unit_cost,
    });
    remaining -= take;
  }

  return { allocations };
}

/**
 * Allocate quantity from a specific lot, or FIFO across asset lots when lotId is omitted.
 */
export function allocateFromLot(
  lots: Lot[],
  quantityToSell: number,
  lotId?: string
): { allocations: FifoAllocation[]; error?: string } {
  if (lotId) {
    const lot = lots.find((l) => l.id === lotId);
    if (!lot) {
      return { allocations: [], error: "Lot not found." };
    }
    if (quantityToSell <= 0 || !Number.isInteger(quantityToSell)) {
      return { allocations: [], error: "Quantity must be a positive whole number." };
    }
    if (quantityToSell > lot.quantity_remaining) {
      return {
        allocations: [],
        error: `Only ${lot.quantity_remaining} unit${lot.quantity_remaining === 1 ? "" : "s"} available in this lot.`,
      };
    }
    return {
      allocations: [
        {
          lotId: lot.id,
          quantity: quantityToSell,
          unitCost: lot.unit_cost,
        },
      ],
    };
  }

  return fifoAllocate(lots, quantityToSell);
}

export function realizedGain(
  unitSalePrice: number,
  allocations: FifoAllocation[]
): number {
  const proceeds = unitSalePrice * allocations.reduce((s, a) => s + a.quantity, 0);
  const cost = allocations.reduce((s, a) => s + a.unitCost * a.quantity, 0);
  return proceeds - cost;
}

export function salesForAsset(sales: CardSale[], assetId: string): CardSale[] {
  return sales.filter((s) => s.asset_id === assetId);
}

export function totalSaleProceeds(sales: CardSale[]): number {
  return sales.reduce((sum, s) => sum + s.sale_price * s.quantity, 0);
}

export function totalSoldQuantity(sales: CardSale[]): number {
  return sales.reduce((sum, s) => sum + s.quantity, 0);
}

export function totalCostBasisAcquired(lots: Lot[]): number {
  return lots.reduce(
    (sum, lot) => sum + lot.unit_cost * lot.quantity_acquired,
    0
  );
}

export function lotsForAsset(lots: Lot[], assetId: string): Lot[] {
  return lots.filter((l) => l.asset_id === assetId);
}

export function groupLotsByAsset(lots: Lot[]): Map<string, Lot[]> {
  const map = new Map<string, Lot[]>();
  for (const lot of lots) {
    const list = map.get(lot.asset_id) ?? [];
    list.push(lot);
    map.set(lot.asset_id, list);
  }
  return map;
}

/** Clone lots reset to acquired qty for FIFO replay (ignores current remaining). */
function cloneLotsForReplay(lots: Lot[]): Lot[] {
  return lots.map((l) => ({
    ...l,
    quantity_remaining: l.quantity_acquired,
  }));
}

/** Lots still held after replaying sales through FIFO as of a date. */
export function heldLotsAtDate(
  lots: Lot[],
  sales: CardSale[],
  asOf: Date
): Lot[] {
  const asOfStr = asOf.toISOString().split("T")[0];
  const eligibleLots = cloneLotsForReplay(
    lots.filter((l) => l.purchase_date <= asOfStr)
  );

  const eligibleSales = [...sales]
    .filter((s) => s.sale_date <= asOfStr)
    .sort((a, b) => a.sale_date.localeCompare(b.sale_date));

  for (const sale of eligibleSales) {
    const { allocations } = fifoAllocate(eligibleLots, sale.quantity);
    for (const alloc of allocations) {
      const lot = eligibleLots.find((l) => l.id === alloc.lotId);
      if (lot) lot.quantity_remaining -= alloc.quantity;
    }
  }

  return eligibleLots.filter((l) => l.quantity_remaining > 0);
}

/** Replay sales through FIFO on lot copies to get holdings as of a date. */
export function holdingsAtDate(
  lots: Lot[],
  sales: CardSale[],
  asOf: Date
): { quantity: number; costBasis: number } {
  const held = heldLotsAtDate(lots, sales, asOf);
  return {
    quantity: quantityHeld(held),
    costBasis: costBasisHeld(held),
  };
}

export interface AssetPosition {
  asset: Asset;
  lots: Lot[];
}

export interface HeldLotPosition {
  asset: Asset;
  lot: Lot;
}

export function buildAssetPositions(
  assets: Asset[],
  lots: Lot[]
): AssetPosition[] {
  const byAsset = groupLotsByAsset(lots);
  return assets.map((asset) => ({
    asset,
    lots: byAsset.get(asset.id) ?? [],
  }));
}

/** Positions with sold lots removed; fully sold assets excluded. */
export function filterHeldPositions(
  positions: AssetPosition[]
): AssetPosition[] {
  return positions
    .map(({ asset, lots }) => ({
      asset,
      lots: lots.filter((l) => l.quantity_remaining > 0),
    }))
    .filter((p) => p.lots.length > 0);
}

export function filterHeldLots(lots: Lot[]): Lot[] {
  return lots.filter((l) => l.quantity_remaining > 0);
}

/** One row per held lot (quantity_remaining > 0). */
export function buildHeldLotPositions(
  assets: Asset[],
  lots: Lot[]
): HeldLotPosition[] {
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  return lots
    .filter((lot) => lot.quantity_remaining > 0)
    .sort((a, b) => {
      const dateCmp = a.purchase_date.localeCompare(b.purchase_date);
      if (dateCmp !== 0) return dateCmp;
      return a.created_at.localeCompare(b.created_at);
    })
    .flatMap((lot) => {
      const asset = assetMap.get(lot.asset_id);
      return asset ? [{ asset, lot }] : [];
    });
}

/** Case-insensitive identity key for grouping the same card across assets/lots. */
export function cardIdentityKey(
  asset: Pick<
    Asset,
    | "player_name"
    | "year"
    | "sport"
    | "card_type"
    | "card_number"
    | "insert_parallel"
  >
): string {
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  return [
    norm(asset.player_name),
    String(asset.year),
    norm(asset.sport),
    norm(asset.card_type),
    norm(asset.card_number),
    norm(asset.insert_parallel),
  ].join("\0");
}

export interface HeldCardGroup {
  key: string;
  asset: Asset;
  items: HeldLotPosition[];
}

export function groupHeldLotsByIdentity(
  positions: HeldLotPosition[]
): HeldCardGroup[] {
  const map = new Map<string, HeldLotPosition[]>();

  for (const pos of positions) {
    const key = cardIdentityKey(pos.asset);
    const list = map.get(key) ?? [];
    list.push(pos);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => {
        const dateCmp = a.lot.purchase_date.localeCompare(b.lot.purchase_date);
        if (dateCmp !== 0) return dateCmp;
        return a.lot.created_at.localeCompare(b.lot.created_at);
      });
      const asset =
        sorted.find((i) => i.asset.image_path)?.asset ?? sorted[0].asset;
      return { key, asset, items: sorted };
    })
    .sort((a, b) => {
      const titleCmp = cardTitle(a.asset).localeCompare(cardTitle(b.asset));
      if (titleCmp !== 0) return titleCmp;
      return a.key.localeCompare(b.key);
    });
}

/** Graded slabs with cert numbers are always single-unit lots. */
export function isSingleUnitLot(
  lot: Pick<Lot, "grader" | "cert_number">
): boolean {
  const graded =
    lot.grader !== "Raw" &&
    lot.grader !== "Ungraded" &&
    Boolean(lot.cert_number?.trim());
  return graded;
}

/** @deprecated Use isSingleUnitLot */
export const isSingleUnitAsset = isSingleUnitLot;
