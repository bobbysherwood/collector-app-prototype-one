"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CardFormData, Grader } from "@/types/card";
import { isGradedGrader } from "@/lib/constants";
import { insertInitialValuation } from "@/app/actions/valuations";

function validateLotGrading(
  grader: Grader,
  grade: string,
  certNumber: string
): string | null {
  if (!isGradedGrader(grader)) return null;
  if (!grade.trim()) return "Grade is required for graded cards.";
  if (!certNumber.trim()) return "Cert number is required for graded cards.";
  return null;
}

function normalizeAssetFields(data: CardFormData) {
  return {
    player_name: data.player_name.trim(),
    year: data.year,
    card_type: data.card_type.trim(),
    sport: data.sport,
    card_number: data.card_number.trim() || null,
    insert_parallel: data.insert_parallel.trim() || null,
    notes: data.notes.trim() || null,
  };
}

function normalizeLotGrading(data: CardFormData) {
  const isGraded = isGradedGrader(data.grader);

  return {
    grader: data.grader,
    grade: isGraded ? data.grade.trim() : null,
    cert_number: isGraded ? data.cert_number.trim() : null,
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

  const gradingError = validateLotGrading(
    data.grader,
    data.grade,
    data.cert_number
  );
  if (gradingError) {
    return { error: gradingError };
  }

  const assetFields = normalizeAssetFields(data);
  const lotGrading = normalizeLotGrading(data);
  const assetId = crypto.randomUUID();

  const { error: assetError } = await supabase.from("assets").insert({
    id: assetId,
    user_id: user.id,
    ...assetFields,
    image_path: imagePath,
  });

  if (assetError) {
    return { error: assetError.message };
  }

  const { data: lot, error: lotError } = await supabase
    .from("lots")
    .insert({
      asset_id: assetId,
      user_id: user.id,
      purchase_date: data.purchase_date,
      unit_cost: data.purchase_price,
      quantity_acquired: 1,
      quantity_remaining: 1,
      ...lotGrading,
    })
    .select("id")
    .single();

  if (lotError || !lot) {
    await supabase.from("assets").delete().eq("id", assetId);
    return { error: lotError?.message ?? "Failed to create lot." };
  }

  if (initialCurrentValue != null && initialCurrentValue >= 0) {
    await insertInitialValuation(lot.id, user.id, initialCurrentValue);
  }

  revalidatePath("/dashboard");
  revalidatePath("/holdings");
  redirect("/holdings");
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

  const { data: lots } = await supabase
    .from("lots")
    .select("id, quantity_remaining")
    .eq("asset_id", id)
    .eq("user_id", user.id)
    .order("purchase_date", { ascending: true });

  const singleLot = lots?.length === 1;

  if (singleLot) {
    const gradingError = validateLotGrading(
      data.grader,
      data.grade,
      data.cert_number
    );
    if (gradingError) {
      return { error: gradingError };
    }
  }

  const assetUpdate: Record<string, unknown> = normalizeAssetFields(data);
  if (imagePath !== undefined) {
    assetUpdate.image_path = imagePath;
  }

  const { error: assetError } = await supabase
    .from("assets")
    .update(assetUpdate)
    .eq("id", id)
    .eq("user_id", user.id);

  if (assetError) {
    return { error: assetError.message };
  }

  if (singleLot && lots) {
    const lot = lots[0];
    const lotGrading = normalizeLotGrading(data);

    const { error: lotError } = await supabase
      .from("lots")
      .update({
        purchase_date: data.purchase_date,
        unit_cost: data.purchase_price,
        quantity_acquired: 1,
        quantity_remaining: lot.quantity_remaining > 0 ? 1 : 0,
        ...lotGrading,
      })
      .eq("id", lot.id);

    if (lotError) {
      return { error: lotError.message };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/holdings");
  revalidatePath(`/cards/${id}`);
  redirect(`/cards/${id}`);
}

export interface AddLotInput {
  purchaseDate: string;
  unitCost: number;
  grader: Grader;
  grade: string;
  certNumber: string;
  initialValue?: number | null;
}

export async function addLot(
  assetId: string,
  input: AddLotInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { purchaseDate, unitCost, grader, grade, certNumber, initialValue } =
    input;

  if (unitCost < 0 || Number.isNaN(unitCost)) {
    return { error: "Unit cost must be a valid positive number." };
  }

  const { data: asset } = await supabase
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .eq("user_id", user.id)
    .single();

  if (!asset) {
    return { error: "Asset not found." };
  }

  const gradingError = validateLotGrading(grader, grade, certNumber);
  if (gradingError) {
    return { error: gradingError };
  }

  const isGraded = isGradedGrader(grader);
  const lotGrading = {
    grader,
    grade: isGraded ? grade.trim() : null,
    cert_number: isGraded ? certNumber.trim() : null,
  };

  const { data: lot, error } = await supabase
    .from("lots")
    .insert({
      asset_id: assetId,
      user_id: user.id,
      purchase_date: purchaseDate,
      unit_cost: unitCost,
      quantity_acquired: 1,
      quantity_remaining: 1,
      ...lotGrading,
    })
    .select("id")
    .single();

  if (error || !lot) {
    return { error: error?.message ?? "Failed to add lot." };
  }

  if (initialValue != null && initialValue >= 0) {
    await insertInitialValuation(lot.id, user.id, initialValue);
  }

  revalidatePath("/dashboard");
  revalidatePath("/holdings");
  revalidatePath(`/cards/${assetId}`);
  return {};
}

export interface UpdateLotInput {
  purchaseDate: string;
  unitCost: number;
  grader: Grader;
  grade: string;
  certNumber: string;
  notes: string;
}

export async function updateLot(
  lotId: string,
  input: UpdateLotInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { purchaseDate, unitCost, grader, grade, certNumber, notes } = input;

  if (unitCost < 0 || Number.isNaN(unitCost)) {
    return { error: "Unit cost must be a valid positive number." };
  }

  const gradingError = validateLotGrading(grader, grade, certNumber);
  if (gradingError) {
    return { error: gradingError };
  }

  const { data: lot } = await supabase
    .from("lots")
    .select("id, asset_id, quantity_remaining")
    .eq("id", lotId)
    .eq("user_id", user.id)
    .single();

  if (!lot) {
    return { error: "Lot not found." };
  }

  if (lot.quantity_remaining <= 0) {
    return { error: "Sold lots cannot be edited." };
  }

  const isGraded = isGradedGrader(grader);
  const { error } = await supabase
    .from("lots")
    .update({
      purchase_date: purchaseDate,
      unit_cost: unitCost,
      grader,
      grade: isGraded ? grade.trim() : null,
      cert_number: isGraded ? certNumber.trim() : null,
      notes: notes.trim() || null,
    })
    .eq("id", lotId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/holdings");
  revalidatePath(`/cards/${lot.asset_id}`);
  return {};
}

export async function deleteLot(
  lotId: string
): Promise<{ error?: string; assetDeleted?: boolean; assetId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
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

  const { data: allocations } = await supabase
    .from("sale_lot_allocations")
    .select("sale_id")
    .eq("lot_id", lotId);

  const saleIds = [
    ...new Set((allocations ?? []).map((row) => row.sale_id)),
  ];

  const { error: allocationError } = await supabase
    .from("sale_lot_allocations")
    .delete()
    .eq("lot_id", lotId);

  if (allocationError) {
    return { error: allocationError.message };
  }

  for (const saleId of saleIds) {
    const { count } = await supabase
      .from("sale_lot_allocations")
      .select("*", { count: "exact", head: true })
      .eq("sale_id", saleId);

    if (count === 0) {
      const { error: saleError } = await supabase
        .from("card_sales")
        .delete()
        .eq("id", saleId)
        .eq("user_id", user.id);

      if (saleError) {
        return { error: saleError.message };
      }
    }
  }

  const { error: lotError } = await supabase
    .from("lots")
    .delete()
    .eq("id", lotId)
    .eq("user_id", user.id);

  if (lotError) {
    return { error: lotError.message };
  }

  const { count: remainingLots } = await supabase
    .from("lots")
    .select("*", { count: "exact", head: true })
    .eq("asset_id", lot.asset_id)
    .eq("user_id", user.id);

  if ((remainingLots ?? 0) === 0) {
    const result = await deleteCard(lot.asset_id);
    if (result?.error) {
      return { error: result.error };
    }
    return { assetDeleted: true, assetId: lot.asset_id };
  }

  revalidatePath("/dashboard");
  revalidatePath("/holdings");
  revalidatePath(`/cards/${lot.asset_id}`);
  return { assetDeleted: false, assetId: lot.asset_id };
}

export async function deleteCard(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: asset } = await supabase
    .from("assets")
    .select("image_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!asset) {
    return { error: "Asset not found." };
  }

  const { data: lots } = await supabase
    .from("lots")
    .select("id")
    .eq("asset_id", id)
    .eq("user_id", user.id);

  const lotIds = (lots ?? []).map((lot) => lot.id);

  const { error: salesError } = await supabase
    .from("card_sales")
    .delete()
    .eq("asset_id", id)
    .eq("user_id", user.id);

  if (salesError) {
    return { error: salesError.message };
  }

  if (lotIds.length > 0) {
    const { error: allocationError } = await supabase
      .from("sale_lot_allocations")
      .delete()
      .in("lot_id", lotIds);

    if (allocationError) {
      return { error: allocationError.message };
    }
  }

  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  if (asset.image_path) {
    await supabase.storage.from("card-images").remove([asset.image_path]);
  }

  revalidatePath("/dashboard");
  revalidatePath("/holdings");
  return {};
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
