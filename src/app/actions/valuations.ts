"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addLotValuation(
  lotId: string,
  value: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  if (value < 0 || Number.isNaN(value)) {
    return { error: "Value must be a positive number." };
  }

  const { data: lot } = await supabase
    .from("lots")
    .select("id, asset_id")
    .eq("id", lotId)
    .eq("user_id", user.id)
    .single();

  if (!lot) {
    return { error: "Lot not found." };
  }

  const { error } = await supabase.from("card_valuations").insert({
    lot_id: lotId,
    user_id: user.id,
    value,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/holdings");
  revalidatePath(`/cards/${lot.asset_id}`);
  return {};
}

/** @deprecated Use addLotValuation */
export async function addCardValuation(
  lotId: string,
  value: number
): Promise<{ error?: string }> {
  return addLotValuation(lotId, value);
}

export async function insertInitialValuation(
  lotId: string,
  userId: string,
  value: number
) {
  const supabase = await createClient();

  await supabase.from("card_valuations").insert({
    lot_id: lotId,
    user_id: userId,
    value,
    recorded_at: new Date().toISOString(),
  });
}
