const MAX_SEGMENT_LENGTH = 80;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_SEGMENT_LENGTH);
}

export function buildCatalogId(entry: {
  year: string;
  brand: string;
  set_label: string;
}): string {
  return [
    "panini",
    "basketball",
    slugify(entry.year),
    slugify(entry.brand),
    slugify(entry.set_label),
  ].join("-");
}
