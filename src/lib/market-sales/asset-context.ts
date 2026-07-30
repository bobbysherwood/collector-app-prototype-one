import { parseCatalogNotes } from "@/lib/card-form-identity";
import type { Asset } from "@/types/asset";

/** Fill marketplace fields from catalog notes when missing on persisted assets. */
export function enrichAssetForMarketSearch(asset: Asset): Asset {
  if (asset.card_set_name?.trim()) {
    return asset;
  }

  const parsed = parseCatalogNotes(asset.notes);
  if (!parsed.card_set_name) {
    return asset;
  }

  return {
    ...asset,
    card_set_name: parsed.card_set_name,
  };
}
