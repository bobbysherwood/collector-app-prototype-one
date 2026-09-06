export function parsePsaHeadingId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{3,10}$/.test(trimmed)) return Number(trimmed);

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    if (/^\d{3,10}$/.test(last)) return Number(last);
  } catch {
    // not a URL
  }

  const match = trimmed.match(/\b(\d{4,10})\b/);
  return match ? Number(match[1]) : null;
}

export function psaHeadingUrl(headingId: number, sportSlug = "basketball-cards"): string {
  return `https://www.psacard.com/pop/${sportSlug}/${headingId}`;
}
