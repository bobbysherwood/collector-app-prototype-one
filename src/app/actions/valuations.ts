"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addCardValuation(
  cardId: string,
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

  const { data: card } = await supabase
    .from("cards")
    .select("id")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .single();

  if (!card) {
    return { error: "Card not found." };
  }

  const { error } = await supabase.from("card_valuations").insert({
    card_id: cardId,
    user_id: user.id,
    value,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/collection");
  revalidatePath(`/cards/${cardId}`);
  return {};
}

export async function insertInitialValuation(
  cardId: string,
  userId: string,
  value: number
) {
  const supabase = await createClient();

  await supabase.from("card_valuations").insert({
    card_id: cardId,
    user_id: userId,
    value,
    recorded_at: new Date().toISOString(),
  });
}
