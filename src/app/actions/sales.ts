"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markCardSold(
  cardId: string,
  saleDate: string,
  salePrice: number
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

  const { data: card, error: fetchError } = await supabase
    .from("cards")
    .select("id, status, quantity, purchase_date")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !card) {
    return { error: "Card not found." };
  }

  if (card.status === "sold") {
    return { error: "This card is already marked as sold." };
  }

  if (saleDate < card.purchase_date) {
    return { error: "Sale date cannot be before the purchase date." };
  }

  const { error: updateError } = await supabase
    .from("cards")
    .update({
      status: "sold",
      sold_at: saleDate,
      sold_price: salePrice,
    })
    .eq("id", cardId)
    .eq("user_id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: saleError } = await supabase.from("card_sales").insert({
    card_id: cardId,
    user_id: user.id,
    sale_date: saleDate,
    sale_price: salePrice,
    quantity: card.quantity,
  });

  if (saleError) {
    await supabase
      .from("cards")
      .update({ status: "held", sold_at: null, sold_price: null })
      .eq("id", cardId);

    return {
      error: saleError.message.includes("card_sales")
        ? "Card updated but sale log failed. Run migration 004_card_sales.sql."
        : saleError.message,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/collection");
  revalidatePath(`/cards/${cardId}`);
  return {};
}
