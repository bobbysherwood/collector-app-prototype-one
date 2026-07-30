import type { Asset, CardFormData, Sport } from "@/types/asset";

const IDENTITY_FIELD_MAX_LENGTH = 100;
const CARD_NUMBER_MAX_LENGTH = 100;

export const DM2_CARD_SET_CATEGORIES = ["Base Set", "Subset", "Insert"] as const;

export function parseCatalogNotes(notes: string | null | undefined): {
  manufacturer: string;
  card_set_category: string;
  card_set_name: string;
  userNotes: string;
} {
  const lines = (notes ?? "").split(/\r?\n/);
  let manufacturer = "";
  let card_set_category = "";
  let card_set_name = "";
  const userLines: string[] = [];
  let inUserNotes = false;

  for (const line of lines) {
    if (inUserNotes) {
      userLines.push(line);
      continue;
    }

    const manufacturerMatch = line.match(/^Manufacturer:\s*(.+)$/i);
    if (manufacturerMatch) {
      manufacturer = manufacturerMatch[1].trim();
      continue;
    }

    const categoryMatch = line.match(/^Category:\s*(.+)$/i);
    if (categoryMatch) {
      card_set_category = categoryMatch[1].trim();
      continue;
    }

    const setMatch = line.match(/^Set:\s*(.+)$/i);
    if (setMatch) {
      card_set_name = setMatch[1].trim();
      continue;
    }

    if (line.trim() === "" && (manufacturer || card_set_category || card_set_name)) {
      inUserNotes = true;
      continue;
    }

    userLines.push(line);
  }

  return {
    manufacturer,
    card_set_category,
    card_set_name,
    userNotes: userLines.join("\n").trim(),
  };
}

export function buildCatalogNotes(input: {
  manufacturer: string;
  card_set_category: string;
  card_set_name: string;
  userNotes: string;
}): string | null {
  const catalogLines = [
    input.manufacturer.trim()
      ? `Manufacturer: ${input.manufacturer.trim()}`
      : null,
    input.card_set_category.trim()
      ? `Category: ${input.card_set_category.trim()}`
      : null,
    input.card_set_name.trim() ? `Set: ${input.card_set_name.trim()}` : null,
  ].filter(Boolean);

  const userNotes = input.userNotes.trim();
  if (catalogLines.length === 0) return userNotes || null;
  if (!userNotes) return catalogLines.join("\n");
  return `${catalogLines.join("\n")}\n\n${userNotes}`;
}

export function assetToCardFormIdentity(
  asset: Pick<
    Asset,
    "player_name" | "year" | "sport" | "card_type" | "card_number" | "insert_parallel" | "notes"
  >
): Pick<
  CardFormData,
  | "player_name"
  | "year"
  | "sport"
  | "manufacturer"
  | "brand"
  | "card_set_category"
  | "card_set_name"
  | "card_number"
  | "insert_parallel"
  | "notes"
> {
  const parsed = parseCatalogNotes(asset.notes);

  return {
    player_name: asset.player_name,
    year: asset.year,
    sport: asset.sport,
    manufacturer: parsed.manufacturer,
    brand: asset.card_type,
    card_set_category: parsed.card_set_category,
    card_set_name: parsed.card_set_name,
    card_number: asset.card_number ?? "",
    insert_parallel: asset.insert_parallel ?? "",
    notes: parsed.userNotes,
  };
}

export function validateCardIdentity(data: CardFormData): string | null {
  if (!data.player_name.trim()) return "Player name is required.";
  if (!data.card_number.trim()) return "Card number is required.";
  if (!data.manufacturer.trim()) return "Manufacturer is required.";
  if (!data.brand.trim()) return "Brand is required.";
  if (!data.card_set_category.trim()) return "Card set category is required.";
  if (!data.card_set_name.trim()) return "Card set name is required.";

  const lengthChecks: [string, string, number][] = [
    ["Player name", data.player_name, IDENTITY_FIELD_MAX_LENGTH],
    ["Manufacturer", data.manufacturer, IDENTITY_FIELD_MAX_LENGTH],
    ["Brand", data.brand, IDENTITY_FIELD_MAX_LENGTH],
    ["Card set category", data.card_set_category, IDENTITY_FIELD_MAX_LENGTH],
    ["Card set name", data.card_set_name, IDENTITY_FIELD_MAX_LENGTH],
    ["Card number", data.card_number, CARD_NUMBER_MAX_LENGTH],
    ["Parallel", data.insert_parallel, IDENTITY_FIELD_MAX_LENGTH],
  ];

  for (const [label, value, maxLength] of lengthChecks) {
    if (value.trim().length > maxLength) {
      return `${label} must be ${maxLength} characters or fewer.`;
    }
  }

  if (!Number.isInteger(data.year) || data.year < 1800 || data.year > 2100) {
    return "Year must be between 1800 and 2100.";
  }

  return null;
}

export function normalizeAssetFieldsFromForm(data: CardFormData) {
  return {
    player_name: data.player_name.trim(),
    year: data.year,
    card_type: data.brand.trim(),
    sport: data.sport as Sport,
    card_number: data.card_number.trim(),
    insert_parallel: data.insert_parallel.trim() || null,
    notes: buildCatalogNotes({
      manufacturer: data.manufacturer,
      card_set_category: data.card_set_category,
      card_set_name: data.card_set_name,
      userNotes: data.notes,
    }),
  };
}

export function lookupNames(
  items: Array<{ name: string }>,
  currentValue?: string | null
): string[] {
  const names = items.map((item) => item.name);
  const trimmed = currentValue?.trim();
  if (!trimmed || names.includes(trimmed)) {
    return [...names].sort((a, b) => a.localeCompare(b));
  }
  return [trimmed, ...names].sort((a, b) => a.localeCompare(b));
}

export function filterBrandNamesForManufacturer(
  brands: Array<{ name: string; manufacturerId: string }>,
  manufacturers: Array<{ id: string; name: string }>,
  manufacturerName: string,
  currentBrand?: string | null
): string[] {
  const manufacturer = manufacturers.find(
    (entry) => entry.name === manufacturerName.trim()
  );
  const filtered = manufacturer
    ? brands.filter((brand) => brand.manufacturerId === manufacturer.id)
    : brands;

  return lookupNames(filtered, currentBrand);
}
