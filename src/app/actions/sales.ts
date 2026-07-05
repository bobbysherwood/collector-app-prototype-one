"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { allocateFromLot } from "@/lib/inventory";

export async function markCardSold(
  assetId: string,
  saleDate: string,
  salePrice: number,
  lotId?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!saleDate) {
    return { error: "Sale date is required." };
  }

  if (salePrice < 0 || Number.isNaN(salePrice)) {
    return { error: "Sale value must be a positive number." };
  }

  const { data: lots, error: lotsError } = await supabase
    .from("lots")
    .select("*")
    .eq("asset_id", assetId)
    .eq("user_id", user.id)
    .order("purchase_date", { ascending: true });

  if (lotsError || !lots?.length) {
    return { error: "Asset not found or has no purchase lots." };
  }

  const relevantLots = lotId ? lots.filter((l) => l.id === lotId) : lots;
  if (lotId && relevantLots.length === 0) {
    return { error: "Lot not found for this asset." };
  }

  const earliestPurchase = relevantLots.reduce(
    (min, lot) => (lot.purchase_date < min ? lot.purchase_date : min),
    relevantLots[0].purchase_date
  );

  if (saleDate < earliestPurchase) {
    return { error: "Sale date cannot be before the purchase date." };
  }

  const { allocations, error: allocError } = allocateFromLot(lots, 1, lotId);
  if (allocError) {
    return { error: allocError };
  }

  const { data: sale, error: saleError } = await supabase
    .from("card_sales")
    .insert({
      asset_id: assetId,
      card_id: assetId,
      user_id: user.id,
      sale_date: saleDate,
      sale_price: salePrice,
      quantity: 1,
    })
    .select("id")
    .single();

  if (saleError || !sale) {
    return {
      error: saleError?.message.includes("card_sales")
        ? "Sale failed. Run migration 007_assets_lots.sql."
        : saleError?.message ?? "Sale failed.",
    };
  }

  for (const alloc of allocations) {
    const lot = lots.find((l) => l.id === alloc.lotId);
    if (!lot) continue;

    const { error: allocInsertError } = await supabase
      .from("sale_lot_allocations")
      .insert({
        sale_id: sale.id,
        lot_id: alloc.lotId,
        quantity: 1,
        unit_cost: alloc.unitCost,
      });

    if (allocInsertError) {
      await supabase.from("card_sales").delete().eq("id", sale.id);
      return { error: allocInsertError.message };
    }

    const { error: lotUpdateError } = await supabase
      .from("lots")
      .update({ quantity_remaining: 0 })
      .eq("id", alloc.lotId);

    if (lotUpdateError) {
      await supabase.from("card_sales").delete().eq("id", sale.id);
      return { error: lotUpdateError.message };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/holdings");
  revalidatePath(`/cards/${assetId}`);
  return {};
}
