export const PLAYER_REVIEW_SIMILARITY = 0.9;

export function normalizePlayerNameKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

export function playerNameSimilarity(left: string, right: string): number {
  const a = normalizePlayerNameKey(left);
  const b = normalizePlayerNameKey(right);
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshteinDistance(a, b) / max;
}

export interface CatalogPlayerPart {
  sportId: string;
  sportLabel: string;
  name: string;
  nameKey: string;
}

export interface PlayerReviewPair {
  sportId: string;
  sportLabel: string;
  leftName: string;
  rightName: string;
  leftKey: string;
  rightKey: string;
  similarity: number;
}

export function classifyCatalogPlayerNames(parts: CatalogPlayerPart[]): {
  autoCreate: CatalogPlayerPart[];
  reviewPairs: PlayerReviewPair[];
} {
  const unique = new Map<string, CatalogPlayerPart>();
  for (const part of parts) {
    const id = `${part.sportId}::${part.nameKey}`;
    const existing = unique.get(id);
    if (!existing || part.name.length > existing.name.length) {
      unique.set(id, part);
    }
  }

  const bySport = new Map<string, CatalogPlayerPart[]>();
  for (const part of unique.values()) {
    const list = bySport.get(part.sportId) ?? [];
    list.push(part);
    bySport.set(part.sportId, list);
  }

  const reviewPairs: PlayerReviewPair[] = [];
  const reviewKeys = new Set<string>();

  for (const rows of bySport.values()) {
    rows.sort((a, b) => a.nameKey.localeCompare(b.nameKey));
    for (let i = 0; i < rows.length; i++) {
      const left = rows[i]!;
      for (let j = i + 1; j < rows.length; j++) {
        const right = rows[j]!;
        const maxLen = Math.max(left.nameKey.length, right.nameKey.length);
        if (
          maxLen > 0 &&
          Math.abs(left.nameKey.length - right.nameKey.length) / maxLen >
            1 - PLAYER_REVIEW_SIMILARITY
        ) {
          continue;
        }
        const similarity = playerNameSimilarity(left.nameKey, right.nameKey);
        if (similarity < PLAYER_REVIEW_SIMILARITY || similarity >= 1) continue;
        reviewPairs.push({
          sportId: left.sportId,
          sportLabel: left.sportLabel,
          leftName: left.name,
          rightName: right.name,
          leftKey: left.nameKey,
          rightKey: right.nameKey,
          similarity,
        });
        reviewKeys.add(`${left.sportId}::${left.nameKey}`);
        reviewKeys.add(`${right.sportId}::${right.nameKey}`);
      }
    }
  }

  reviewPairs.sort(
    (a, b) =>
      b.similarity - a.similarity ||
      a.sportLabel.localeCompare(b.sportLabel) ||
      a.leftName.localeCompare(b.leftName)
  );

  const autoCreate = [...unique.values()].filter(
    (part) => !reviewKeys.has(`${part.sportId}::${part.nameKey}`)
  );

  return { autoCreate, reviewPairs };
}