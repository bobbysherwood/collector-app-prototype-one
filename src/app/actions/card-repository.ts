"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sortByCardNumber } from "@/lib/card-number-order";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";
import type {
  CardRepositoryEntryInput,
  CardRepositorySetKey,
} from "@/types/card-repository";

async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Unauthorized" as const };
  }
  return { error: null };
}

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function validateEntry(input: CardRepositoryEntryInput): string | null {
  const required: [string, string][] = [
    ["Category", input.category],
    ["Manufacturer", input.manufacturer],
    ["Brand", input.brand],
    ["Card Set Category", input.cardSetCategory],
    ["Card Set", input.cardSet],
    ["Card Number", input.cardNumber],
    ["Player", input.player],
  ];

  for (const [label, value] of required) {
    if (!trim(value)) {
      return `${label} is required.`;
    }
    if (value.length > (label === "Category" ? 50 : label === "Card Number" ? 20 : 100)) {
      return `${label} exceeds the maximum length.`;
    }
  }

  if (!Number.isInteger(input.year) || input.year < 1800 || input.year > 2100) {
    return "Year must be a valid release year.";
  }

  if (
    input.serialNumber != null &&
    (!Number.isInteger(input.serialNumber) || input.serialNumber <= 0)
  ) {
    return "Serial Number must be a positive whole number.";
  }

  return null;
}

function toDbRow(input: CardRepositoryEntryInput) {
  const parallel = trim(input.parallel);
  const releaseDate = trim(input.releaseDate);

  return {
    category: trim(input.category),
    year: input.year,
    manufacturer: trim(input.manufacturer),
    brand: trim(input.brand),
    card_set_category: trim(input.cardSetCategory),
    card_set: trim(input.cardSet),
    card_number: trim(input.cardNumber),
    player: trim(input.player),
    parallel: parallel || null,
    serial_number: input.serialNumber ?? null,
    release_date: releaseDate || null,
  };
}

export async function createCardRepositoryEntry(
  input: CardRepositoryEntryInput
): Promise<{ error?: string; cardId?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const validationError = validateEntry(input);
  if (validationError) {
    return { error: validationError };
  }

  const parallel = trim(input.parallel);
  const releaseDate = trim(input.releaseDate);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_repository")
    .insert(toDbRow(input))
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "A card with the same Category, Year, Manufacturer, Brand, Card Set, Card Number, Player, and Parallel already exists.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { cardId: data.id };
}

export async function importCardRepositoryEntries(
  entries: CardRepositoryEntryInput[]
): Promise<{
  error?: string;
  imported?: number;
  skipped?: number;
  rowErrors?: string[];
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (entries.length === 0) {
    return { error: "No rows to import." };
  }

  if (entries.length > 5000) {
    return { error: "Imports are limited to 5,000 rows at a time." };
  }

  const supabase = await createClient();
  let imported = 0;
  let skipped = 0;
  const rowErrors: string[] = [];

  for (let index = 0; index < entries.length; index++) {
    const rowNumber = index + 1;
    const validationError = validateEntry(entries[index]);
    if (validationError) {
      rowErrors.push(`Row ${rowNumber}: ${validationError}`);
      continue;
    }

    const { error } = await supabase
      .from("card_repository")
      .insert(toDbRow(entries[index]));

    if (error) {
      if (error.code === "23505") {
        skipped += 1;
        rowErrors.push(`Row ${rowNumber}: Duplicate entry skipped.`);
      } else {
        rowErrors.push(`Row ${rowNumber}: ${error.message}`);
      }
      continue;
    }

    imported += 1;
  }

  if (imported > 0) {
    revalidatePath("/admin");
  }

  if (imported === 0 && skipped === 0 && rowErrors.length > 0) {
    return { error: "No rows were imported.", rowErrors };
  }

  if (imported === 0 && skipped > 0) {
    return {
      error: `This card set already exists in the repository. No new cards were imported (${skipped} duplicate${skipped === 1 ? "" : "s"} skipped).`,
      imported,
      skipped,
      rowErrors,
    };
  }

  return { imported, skipped, rowErrors };
}

export async function deleteCardRepositorySet(
  set: CardRepositorySetKey
): Promise<{ error?: string; deleted?: number }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_repository")
    .delete()
    .eq("category", set.category)
    .eq("year", set.year)
    .eq("manufacturer", set.manufacturer)
    .eq("brand", set.brand)
    .eq("card_set", set.cardSet)
    .select("id");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { deleted: data?.length ?? 0 };
}

export async function getCardRepositorySetExportRows(set: CardRepositorySetKey) {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_repository")
    .select(
      "category, year, manufacturer, brand, card_set_category, card_set, card_number, player, parallel, serial_number, release_date"
    )
    .eq("category", set.category)
    .eq("year", set.year)
    .eq("manufacturer", set.manufacturer)
    .eq("brand", set.brand)
    .eq("card_set", set.cardSet);

  if (error) {
    return { error: error.message };
  }

  return {
    rows: sortByCardNumber(
      (data ?? []).map((row) => ({
        category: row.category,
        year: row.year,
        manufacturer: row.manufacturer,
        brand: row.brand,
        cardSetCategory: row.card_set_category,
        cardSet: row.card_set,
        cardNumber: row.card_number,
        player: row.player,
        parallel: row.parallel,
        serialNumber: row.serial_number,
        releaseDate: row.release_date,
      }))
    ),
  };
}

export async function listCardRepositoryCardsForSet(set: CardRepositorySetKey) {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_repository")
    .select(
      "id, card_set_category, card_number, player, parallel, serial_number, release_date"
    )
    .eq("category", set.category)
    .eq("year", set.year)
    .eq("manufacturer", set.manufacturer)
    .eq("brand", set.brand)
    .eq("card_set", set.cardSet);

  if (error) {
    return { error: error.message };
  }

  return {
    cards: sortByCardNumber(
      (data ?? []).map((row) => ({
        id: row.id,
        cardSetCategory: row.card_set_category,
        cardNumber: row.card_number,
        player: row.player,
        parallel: row.parallel,
        serialNumber: row.serial_number,
        releaseDate: row.release_date,
      }))
    ),
  };
}
