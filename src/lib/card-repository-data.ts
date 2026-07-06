import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";
import type { CardRepositorySetSummary } from "@/types/card-repository";

export async function getCardRepositorySets(): Promise<CardRepositorySetSummary[]> {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_card_repository_sets");

  if (error) {
    console.error("Failed to load card repository sets:", error.message);
    return [];
  }

  return (data ?? []).map((row: {
    category: string;
    year: number;
    manufacturer: string;
    brand: string;
    card_set: string;
    cards: number;
  }) => ({
    category: row.category,
    year: row.year,
    manufacturer: row.manufacturer,
    brand: row.brand,
    cardSet: row.card_set,
    cards: Number(row.cards),
  }));
}
