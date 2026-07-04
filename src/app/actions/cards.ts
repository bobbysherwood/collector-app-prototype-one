"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CardFormData } from "@/types/card";
import { GRADED_BY } from "@/lib/constants";
import { insertInitialValuation } from "@/app/actions/valuations";

function normalizeCardData(data: CardFormData) {
  const isGraded = GRADED_BY.includes(data.grader);

  return {
    player_name: data.player_name.trim(),
    year: data.year,
    card_type: data.card_type.trim(),
    sport: data.sport,
    card_number: data.card_number.trim() || null,
    insert_parallel: data.insert_parallel.trim() || null,
    grader: data.grader,
    grade: isGraded ? data.grade.trim() || null : null,
    cert_number: isGraded ? data.cert_number.trim() || null : null,
    purchase_date: data.purchase_date,
    purchase_price: data.purchase_price,
    quantity: data.quantity,
    notes: data.notes.trim() || null,
  };
}

export async function createCard(
  data: CardFormData,
  imagePath: string | null,
  initialCurrentValue?: number | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      ...normalizeCardData(data),
      user_id: user.id,
      image_path: imagePath,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (initialCurrentValue != null && initialCurrentValue >= 0) {
    await insertInitialValuation(card.id, user.id, initialCurrentValue);
  }

  revalidatePath("/dashboard");
  revalidatePath("/collection");
  redirect("/collection");
}

export async function updateCard(
  id: string,
  data: CardFormData,
  imagePath: string | null | undefined
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const updateData: Record<string, unknown> = normalizeCardData(data);
  if (imagePath !== undefined) {
    updateData.image_path = imagePath;
  }

  const { error } = await supabase
    .from("cards")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/collection");
  revalidatePath(`/cards/${id}`);
  redirect(`/cards/${id}`);
}

export async function deleteCard(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: card } = await supabase
    .from("cards")
    .select("image_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("cards")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  if (card?.image_path) {
    await supabase.storage.from("card-images").remove([card.image_path]);
  }

  revalidatePath("/dashboard");
  revalidatePath("/collection");
  redirect("/collection");
}

export async function uploadCardImage(
  formData: FormData
): Promise<{ path: string | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { path: null, error: "Not authenticated" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { path: null };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("card-images")
    .upload(fileName, file, { upsert: false });

  if (error) {
    return { path: null, error: error.message };
  }

  return { path: fileName };
}
