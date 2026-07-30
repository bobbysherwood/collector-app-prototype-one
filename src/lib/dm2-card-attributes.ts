import { parseCatalogNotes } from "@/lib/card-form-identity";
import { createClient } from "@/lib/supabase/server";
import { normalizeRpcRows } from "@/lib/supabase/rpc-rows";
import type { Asset } from "@/types/asset";

export function assetToDm2AttributeLookupRequest(asset: Asset) {
  const parsed = parseCatalogNotes(asset.notes);

  return {
    asset_id: asset.id,
    player: asset.player_name,
    card_number: asset.card_number ?? "",
    sport: asset.sport,
    year: asset.year,
    brand: asset.card_type,
    manufacturer: parsed.manufacturer,
    card_set_category: parsed.card_set_category,
    card_set_name: parsed.card_set_name,
    parallel: asset.insert_parallel ?? "",
  };
}

function isMissingAttributeLookupError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    (error.message?.includes("lookup_dm2_card_attributes_batch") ?? false) ||
    (error.message?.includes("dm2_card_attributes") ?? false)
  );
}

export async function getDm2AttributeNamesByAssets(
  assets: Asset[]
): Promise<Record<string, string[]>> {
  if (assets.length === 0) return {};

  const uniqueAssets = [...new Map(assets.map((asset) => [asset.id, asset])).values()];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lookup_dm2_card_attributes_batch", {
    requests: uniqueAssets.map(assetToDm2AttributeLookupRequest),
  });

  if (error) {
    if (!isMissingAttributeLookupError(error)) {
      console.error("Failed to lookup card attributes:", error.message);
    }
    return {};
  }

  const map: Record<string, string[]> = {};
  for (const row of normalizeRpcRows(data) as Array<{
    asset_id: string;
    attribute_names: string[] | null;
  }>) {
    map[row.asset_id] = row.attribute_names ?? [];
  }

  return map;
}

export async function getDm2AttributeNamesForAsset(
  asset: Asset
): Promise<string[]> {
  const map = await getDm2AttributeNamesByAssets([asset]);
  return map[asset.id] ?? [];
}
