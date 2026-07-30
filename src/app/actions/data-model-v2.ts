"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeRpcRows } from "@/lib/supabase/rpc-rows";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";

const MAX_NAME_LENGTH = 100;

async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Unauthorized" as const };
  }
  return { error: null };
}

function normalizeName(name: string): string {
  return name.trim();
}

function validateName(name: string): string | null {
  if (!name) return "Name is required.";
  if (name.length > MAX_NAME_LENGTH) {
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  return null;
}

function revalidateDataModelV2Paths() {
  revalidatePath("/admin");
}

export async function createDm2CardSetCategory(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_set_categories").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set category with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2CardSetCategory(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_categories")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set category with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2CardSetCategoryActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_categories")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2CardSetCategory(
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_categories")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2CardSetName(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_set_names").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set name with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2CardSetName(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_names")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set name with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2CardSetNameActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_names")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2CardSetName(
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_names")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2Manufacturer(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_manufacturers").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A manufacturer with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Manufacturer(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_manufacturers")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A manufacturer with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2ManufacturerActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_manufacturers")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Manufacturer(
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_manufacturers")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2Brand(input: {
  name: string;
  manufacturerId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  if (!input.manufacturerId) {
    return { error: "Manufacturer is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_brands").insert({
    name,
    manufacturer_id: input.manufacturerId,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A brand with that name already exists for this manufacturer.",
      };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Brand(input: {
  id: string;
  name: string;
  manufacturerId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  if (!input.manufacturerId) {
    return { error: "Manufacturer is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_brands")
    .update({
      name,
      manufacturer_id: input.manufacturerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A brand with that name already exists for this manufacturer.",
      };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2BrandActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_brands")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Brand(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_brands").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2Parallel(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_parallels").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A parallel with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Parallel(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_parallels")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A parallel with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2ParallelActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_parallels")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Parallel(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_parallels").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2Attribute(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_attributes").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "An attribute with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Attribute(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_attributes")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "An attribute with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2AttributeActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_attributes")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Attribute(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_attributes").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function assignDm2CardAttribute(input: {
  cardId: string;
  attributeId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!input.cardId.trim() || !input.attributeId.trim()) {
    return { error: "Card and attribute are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_attributes").insert({
    card_id: input.cardId,
    attribute_id: input.attributeId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That attribute is already assigned to this card." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2CardAttribute(input: {
  id: string;
  attributeId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!input.id.trim() || !input.attributeId.trim()) {
    return { error: "Assignment and attribute are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_attributes")
    .update({ attribute_id: input.attributeId })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "That attribute is already assigned to this card." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function removeDm2CardAttribute(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_attributes").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

const MIN_YEAR = 1800;
const MAX_YEAR = 2100;

function validateYear(year: number): string | null {
  if (!Number.isInteger(year)) {
    return "Year must be a whole number.";
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`;
  }
  return null;
}

function validateCardSetLinks(input: {
  sportId: string;
  brandId: string;
  cardSetCategoryId: string;
  cardSetNameId: string;
}): string | null {
  if (!input.sportId) return "Sport is required.";
  if (!input.brandId) return "Manufacturer / brand is required.";
  if (!input.cardSetCategoryId) return "Card set category is required.";
  if (!input.cardSetNameId) return "Card set name is required.";
  return null;
}

export async function createDm2CardSet(input: {
  sportId: string;
  year: number;
  brandId: string;
  cardSetCategoryId: string;
  cardSetNameId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const yearError = validateYear(input.year);
  if (yearError) return { error: yearError };

  const linkError = validateCardSetLinks(input);
  if (linkError) return { error: linkError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_sets").insert({
    sport_id: input.sportId,
    year: input.year,
    brand_id: input.brandId,
    card_set_category_id: input.cardSetCategoryId,
    card_set_name_id: input.cardSetNameId,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set with that combination already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2CardSet(input: {
  id: string;
  sportId: string;
  year: number;
  brandId: string;
  cardSetCategoryId: string;
  cardSetNameId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const yearError = validateYear(input.year);
  if (yearError) return { error: yearError };

  const linkError = validateCardSetLinks(input);
  if (linkError) return { error: linkError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_sets")
    .update({
      sport_id: input.sportId,
      year: input.year,
      brand_id: input.brandId,
      card_set_category_id: input.cardSetCategoryId,
      card_set_name_id: input.cardSetNameId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set with that combination already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2CardSetActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_sets")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2CardSet(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_sets").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

function validateCardField(
  value: string,
  fieldLabel: string
): { value: string; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: trimmed, error: `${fieldLabel} is required.` };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      value: trimmed,
      error: `${fieldLabel} must be ${MAX_NAME_LENGTH} characters or fewer.`,
    };
  }
  return { value: trimmed, error: null };
}

export async function createDm2Card(input: {
  cardSetId: string;
  cardNumber: string;
  player: string;
  parallelId?: string | null;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!input.cardSetId) {
    return { error: "Card set is required." };
  }

  const cardNumber = validateCardField(input.cardNumber, "Card #");
  if (cardNumber.error) return { error: cardNumber.error };

  const player = validateCardField(input.player, "Player");
  if (player.error) return { error: player.error };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_cards").insert({
    card_set_id: input.cardSetId,
    card_number: cardNumber.value,
    player: player.value,
    parallel_id: input.parallelId?.trim() ? input.parallelId : null,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A card with that number and player already exists in this card set." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Card(input: {
  id: string;
  cardSetId: string;
  cardNumber: string;
  player: string;
  parallelId?: string | null;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!input.cardSetId) {
    return { error: "Card set is required." };
  }

  const cardNumber = validateCardField(input.cardNumber, "Card #");
  if (cardNumber.error) return { error: cardNumber.error };

  const player = validateCardField(input.player, "Player");
  if (player.error) return { error: player.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_cards")
    .update({
      card_set_id: input.cardSetId,
      card_number: cardNumber.value,
      player: player.value,
      parallel_id: input.parallelId?.trim() ? input.parallelId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A card with that number and player already exists in this card set." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2CardActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_cards")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Card(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data: card, error: fetchError } = await supabase
    .from("dm2_cards")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  const { error } = await supabase.from("dm2_cards").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  if (card?.image_path) {
    await supabase.storage
      .from(DM2_CARD_IMAGES_BUCKET)
      .remove([card.image_path]);
  }

  revalidateDataModelV2Paths();
  return {};
}

const DM2_CARD_IMAGES_BUCKET = "dm2-card-images";

const ALLOWED_DM2_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function extensionForImageFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "jpg" || fromName === "jpeg") return "jpg";
  if (fromName === "png") return "png";
  if (fromName === "webp") return "webp";

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function dm2CardImageStoragePath(cardId: string, ext: string): string {
  return `cards/${cardId}.${ext}`;
}

export async function uploadDm2CardImage(
  cardId: string,
  formData: FormData
): Promise<{ error?: string; imagePath?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const trimmedId = cardId.trim();
  if (!trimmedId) {
    return { error: "Card id is required." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Image file is required." };
  }

  if (!ALLOWED_DM2_IMAGE_TYPES.has(file.type)) {
    return { error: "Image must be JPG, PNG, or WebP." };
  }

  const supabase = await createClient();
  const { data: existingCard, error: fetchError } = await supabase
    .from("dm2_cards")
    .select("image_path")
    .eq("id", trimmedId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!existingCard) {
    return { error: "Card not found." };
  }

  const ext = extensionForImageFile(file);
  const nextPath = dm2CardImageStoragePath(trimmedId, ext);

  const { error: uploadError } = await supabase.storage
    .from(DM2_CARD_IMAGES_BUCKET)
    .upload(nextPath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: updateError } = await supabase
    .from("dm2_cards")
    .update({
      image_path: nextPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trimmedId);

  if (updateError) {
    return { error: updateError.message };
  }

  const previousPath = existingCard.image_path;
  if (previousPath && previousPath !== nextPath) {
    await supabase.storage.from(DM2_CARD_IMAGES_BUCKET).remove([previousPath]);
  }

  revalidateDataModelV2Paths();
  return { imagePath: nextPath };
}

export async function deleteDm2CardImage(
  cardId: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const trimmedId = cardId.trim();
  if (!trimmedId) {
    return { error: "Card id is required." };
  }

  const supabase = await createClient();
  const { data: card, error: fetchError } = await supabase
    .from("dm2_cards")
    .select("image_path")
    .eq("id", trimmedId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!card) {
    return { error: "Card not found." };
  }

  if (!card.image_path) {
    return {};
  }

  const { error: updateError } = await supabase
    .from("dm2_cards")
    .update({
      image_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trimmedId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: removeError } = await supabase.storage
    .from(DM2_CARD_IMAGES_BUCKET)
    .remove([card.image_path]);

  if (removeError) {
    return { error: removeError.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function fetchDm2CardsForCardSet(
  cardSetId: string
): Promise<{ error?: string; cards?: import("@/types/data-model-v2").Dm2Card[] }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const trimmed = cardSetId.trim();
  if (!trimmed) return { error: "Card set is required." };

  const { getDm2CardsBySetId } = await import("@/lib/data-model-v2-data");
  const cards = await getDm2CardsBySetId(trimmed);
  return { cards };
}

export async function fetchDm2CardCountsBySetId(): Promise<{
  error?: string;
  counts?: Record<string, number>;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const { getDm2CardCountsBySetId } = await import("@/lib/data-model-v2-data");
  const counts = await getDm2CardCountsBySetId();
  return { counts };
}

export async function searchDm2Cards(
  query: string
): Promise<{ error?: string; cards?: import("@/types/data-model-v2").Dm2CardSearchResult[] }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { cards: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to search the card catalog." };
  }

  const { data, error } = await supabase.rpc("search_dm2_cards", {
    query: trimmed,
    lim: 50,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    cards: normalizeRpcRows(data).map((row) =>
      mapDm2CardSearchRow(row as Parameters<typeof mapDm2CardSearchRow>[0])
    ),
  };
}

function mapDm2CardSearchRow(row: {
  id: string;
  card_set_id: string;
  sport: string;
  year: number;
  manufacturer: string;
  brand: string;
  card_set_category: string;
  card_set_name: string;
  card_number: string;
  player: string;
  parallel: string | null;
  image_path?: string | null;
  attribute_names?: string[] | null;
}): import("@/types/data-model-v2").Dm2CardSearchResult {
  return {
    id: row.id,
    cardSetId: row.card_set_id,
    sportName: row.sport,
    year: row.year,
    manufacturerName: row.manufacturer,
    brandName: row.brand,
    cardSetCategoryName: row.card_set_category,
    cardSetName: row.card_set_name,
    cardNumber: row.card_number,
    player: row.player,
    parallelName: row.parallel,
    imagePath: row.image_path ?? null,
    attributeNames: row.attribute_names ?? [],
  };
}

export async function getDm2CardById(
  cardId: string
): Promise<{ error?: string; card?: import("@/types/data-model-v2").Dm2CardSearchResult }> {
  const trimmed = cardId.trim();
  if (!trimmed) {
    return { error: "Card id is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to view card details." };
  }

  const { data, error } = await supabase.rpc("get_dm2_card_by_id", {
    card_id: trimmed,
  });

  if (error) {
    return { error: error.message };
  }

  const rows = normalizeRpcRows(data);
  if (rows.length === 0) {
    return { error: "Card not found." };
  }

  return {
    card: mapDm2CardSearchRow(
      rows[0] as Parameters<typeof mapDm2CardSearchRow>[0]
    ),
  };
}

export async function searchDm2Players(
  query: string
): Promise<{ error?: string; players?: import("@/types/data-model-v2").Dm2PlayerSearchResult[] }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { players: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to search the card catalog." };
  }

  const { data, error } = await supabase.rpc("search_dm2_players", {
    query: trimmed,
    lim: 50,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    players: normalizeRpcRows(data).map(
      (row: { player: string; card_count: number }) => ({
        player: row.player,
        cardCount: Number(row.card_count),
      })
    ),
  };
}

export async function searchDm2Sports(
  query: string
): Promise<{ error?: string; sports?: import("@/types/data-model-v2").Dm2SportSearchResult[] }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { sports: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to search the card catalog." };
  }

  const { data, error } = await supabase.rpc("search_dm2_sports", {
    query: trimmed,
    lim: 50,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    sports: normalizeRpcRows(data).map(
      (row: {
        sport: string;
        card_set_count: number;
        card_count: number;
      }) => ({
        sport: row.sport,
        cardSetCount: Number(row.card_set_count),
        cardCount: Number(row.card_count),
      })
    ),
  };
}
