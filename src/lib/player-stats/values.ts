export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function readRecordNumber(
  record: Record<string, unknown> | undefined,
  keys: string[]
): number | null {
  if (!record) return null;
  for (const key of keys) {
    if (key in record) {
      const value = asNumber(record[key]);
      if (value != null) return value;
    }
    const match = Object.entries(record).find(
      ([entryKey]) => entryKey.toLowerCase() === key.toLowerCase()
    );
    if (match) {
      const value = asNumber(match[1]);
      if (value != null) return value;
    }
  }
  return null;
}

export function readRecordString(
  record: Record<string, unknown> | undefined,
  keys: string[]
): string | null {
  if (!record) return null;
  for (const key of keys) {
    if (key in record) {
      const value = asString(record[key]);
      if (value) return value;
    }
  }
  return null;
}
