import {
  PLAYER_REVIEW_SIMILARITY,
  normalizePlayerNameKey,
  playerNameSimilarity,
} from "@/lib/dm2-player-match";
import type {
  Dm2ExtractedRow,
  Dm2ImportCatalogContext,
  Dm2ImportPlayerName,
  Dm2ImportPlayerReview,
  Dm2ImportPlayerReviewPair,
  Dm2ImportPlayerReviewSide,
  Dm2ImportSession,
  Dm2PlayerPairResolution,
} from "@/types/dm2-import";

export function splitImportPlayerParts(player: string | undefined): string[] {
  if (!player?.trim()) return [];
  return player
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function importPlayerNameKey(sportKey: string, nameKey: string): string {
  return `${sportKey}::${nameKey}`;
}

function normalizeSportKey(value: string): string {
  return value.trim().toLowerCase();
}

function catalogSportId(
  catalog: Dm2ImportCatalogContext | undefined,
  sportKey: string
): string | undefined {
  return catalog?.sports.find(
    (sport) => normalizeSportKey(sport.label) === sportKey
  )?.id;
}

function resolvedSportIdFromProposals(
  session: Dm2ImportSession,
  sportKey: string
): string | undefined {
  const proposal = session.proposals.find((item) => {
    if (item.entityType !== "sport") return false;
    if (normalizeSportKey(item.proposedName) === sportKey) return true;
    return Boolean(item.matchName && normalizeSportKey(item.matchName) === sportKey);
  });
  if (proposal?.action === "use_existing" && proposal.matchId) {
    return proposal.matchId;
  }
  return undefined;
}

function rowSport(
  row: Dm2ExtractedRow,
  session: Dm2ImportSession
): { sportKey: string; sportLabel: string; sportId?: string } | null {
  const sportLabel =
    row.sport?.trim() || session.sessionContext.sport?.trim() || "";
  if (!sportLabel) return null;
  const sportKey = normalizeSportKey(sportLabel);
  const sportId =
    catalogSportId(session.catalog, sportKey) ??
    resolvedSportIdFromProposals(session, sportKey);
  return { sportKey, sportLabel, sportId };
}

interface CatalogPlayerName {
  playerId: string;
  sportId: string;
  name: string;
  nameKey: string;
}

function catalogNamesBySport(
  catalog: Dm2ImportCatalogContext | undefined
): Map<string, CatalogPlayerName[]> {
  const bySport = new Map<string, CatalogPlayerName[]>();
  if (!catalog) return bySport;

  const seen = new Set<string>();
  const add = (entry: CatalogPlayerName) => {
    const id = `${entry.sportId}::${entry.nameKey}`;
    if (seen.has(id)) return;
    seen.add(id);
    const list = bySport.get(entry.sportId) ?? [];
    list.push(entry);
    bySport.set(entry.sportId, list);
  };

  for (const player of catalog.players ?? []) {
    add({
      playerId: player.id,
      sportId: player.sportId,
      name: player.name,
      nameKey: player.nameKey || normalizePlayerNameKey(player.name),
    });
  }

  for (const alias of catalog.playerAliases ?? []) {
    add({
      playerId: alias.playerId,
      sportId: alias.sportId,
      name: alias.name,
      nameKey: alias.nameKey || normalizePlayerNameKey(alias.name),
    });
  }

  return bySport;
}

function shouldSkipLength(leftKey: string, rightKey: string): boolean {
  const maxLen = Math.max(leftKey.length, rightKey.length);
  return (
    maxLen > 0 &&
    Math.abs(leftKey.length - rightKey.length) / maxLen >
      1 - PLAYER_REVIEW_SIMILARITY
  );
}

function pairId(sportKey: string, leftKey: string, rightKey: string): string {
  const [first, second] = [leftKey, rightKey].sort();
  return `${sportKey}::${first}::${second}`;
}

function sideFromImport(name: Dm2ImportPlayerName): Dm2ImportPlayerReviewSide {
  return {
    name: name.name,
    nameKey: name.nameKey,
    catalogPlayerId: name.exactMatchId,
  };
}

function sideFromCatalog(entry: CatalogPlayerName): Dm2ImportPlayerReviewSide {
  return {
    name: entry.name,
    nameKey: entry.nameKey,
    catalogPlayerId: entry.playerId,
  };
}

export function buildImportPlayerReview(
  session: Dm2ImportSession
): Dm2ImportPlayerReview {
  const names = new Map<string, Dm2ImportPlayerName>();

  for (const row of session.rows) {
    if (row.excluded) continue;
    const sport = rowSport(row, session);
    if (!sport) continue;

    for (const part of splitImportPlayerParts(row.player)) {
      const nameKey = normalizePlayerNameKey(part);
      if (!nameKey) continue;
      const key = importPlayerNameKey(sport.sportKey, nameKey);
      const existing = names.get(key);
      if (existing) {
        existing.rowCount += 1;
        if (part.length > existing.name.length) existing.name = part;
        continue;
      }
      names.set(key, {
        key,
        sportKey: sport.sportKey,
        sportLabel: sport.sportLabel,
        sportId: sport.sportId,
        name: part,
        nameKey,
        rowCount: 1,
      });
    }
  }

  const catalogBySport = catalogNamesBySport(session.catalog);
  const catalogByKey = new Map<string, CatalogPlayerName>();
  for (const entries of catalogBySport.values()) {
    for (const entry of entries) {
      catalogByKey.set(`${entry.sportId}::${entry.nameKey}`, entry);
    }
  }

  for (const name of names.values()) {
    if (!name.sportId) continue;
    const match = catalogByKey.get(`${name.sportId}::${name.nameKey}`);
    if (!match) continue;
    name.exactMatchId = match.playerId;
    name.exactMatchName = match.name;
  }

  const pairs: Dm2ImportPlayerReviewPair[] = [];
  const pairIds = new Set<string>();

  const addPair = (
    sportKey: string,
    sportLabel: string,
    left: Dm2ImportPlayerReviewSide,
    right: Dm2ImportPlayerReviewSide,
    similarity: number
  ) => {
    const id = pairId(sportKey, left.nameKey, right.nameKey);
    if (pairIds.has(id)) return;
    pairIds.add(id);
    const ordered =
      left.nameKey <= right.nameKey
        ? { left, right }
        : { left: right, right: left };
    pairs.push({
      id,
      sportKey,
      sportLabel,
      ...ordered,
      similarity,
    });
  };

  const bySport = new Map<string, Dm2ImportPlayerName[]>();
  for (const name of names.values()) {
    const list = bySport.get(name.sportKey) ?? [];
    list.push(name);
    bySport.set(name.sportKey, list);
  }

  for (const [sportKey, sportNames] of bySport) {
    const unmatched = sportNames.filter((name) => !name.exactMatchId);
    unmatched.sort((a, b) => a.nameKey.localeCompare(b.nameKey));

    for (let i = 0; i < unmatched.length; i++) {
      const left = unmatched[i]!;
      for (let j = i + 1; j < unmatched.length; j++) {
        const right = unmatched[j]!;
        if (shouldSkipLength(left.nameKey, right.nameKey)) continue;
        const similarity = playerNameSimilarity(left.nameKey, right.nameKey);
        if (similarity < PLAYER_REVIEW_SIMILARITY || similarity >= 1) continue;
        addPair(
          sportKey,
          left.sportLabel,
          sideFromImport(left),
          sideFromImport(right),
          similarity
        );
      }
    }

    const catalogNames = unmatched[0]?.sportId
      ? catalogBySport.get(unmatched[0].sportId) ?? []
      : [];

    for (const importName of unmatched) {
      const bestByPlayer = new Map<string, { entry: CatalogPlayerName; similarity: number }>();
      for (const catalogName of catalogNames) {
        if (catalogName.nameKey === importName.nameKey) continue;
        if (shouldSkipLength(importName.nameKey, catalogName.nameKey)) continue;
        const similarity = playerNameSimilarity(
          importName.nameKey,
          catalogName.nameKey
        );
        if (similarity < PLAYER_REVIEW_SIMILARITY || similarity >= 1) continue;
        const current = bestByPlayer.get(catalogName.playerId);
        if (!current || similarity > current.similarity) {
          bestByPlayer.set(catalogName.playerId, {
            entry: catalogName,
            similarity,
          });
        }
      }
      for (const match of bestByPlayer.values()) {
        addPair(
          sportKey,
          importName.sportLabel,
          sideFromImport(importName),
          sideFromCatalog(match.entry),
          match.similarity
        );
      }
    }
  }

  pairs.sort(
    (a, b) =>
      b.similarity - a.similarity ||
      a.sportLabel.localeCompare(b.sportLabel) ||
      a.left.name.localeCompare(b.left.name)
  );

  return {
    names: [...names.values()].sort(
      (a, b) =>
        a.sportLabel.localeCompare(b.sportLabel) || a.name.localeCompare(b.name)
    ),
    pairs,
    resolutions: {},
  };
}

export function mergeImportPlayerReview(
  session: Dm2ImportSession
): Dm2ImportPlayerReview {
  const built = buildImportPlayerReview(session);
  const previous = session.playerReview?.resolutions ?? {};
  const pairIds = new Set(built.pairs.map((pair) => pair.id));
  built.resolutions = Object.fromEntries(
    Object.entries(previous).filter(([id]) => pairIds.has(id))
  );
  return built;
}

export function countPendingPlayerReviewPairs(
  review: Dm2ImportPlayerReview | undefined
): number {
  if (!review) return 0;
  return review.pairs.filter((pair) => review.resolutions[pair.id] == null).length;
}

export function countRowsMissingPlayer(session: Dm2ImportSession): number {
  return session.rows.filter(
    (row) => !row.excluded && splitImportPlayerParts(row.player).length === 0
  ).length;
}

export function summarizeImportPlayerReview(review: Dm2ImportPlayerReview): {
  uniqueNames: number;
  catalogMatches: number;
  newNames: number;
  pendingPairs: number;
} {
  const pendingNameKeys = new Set<string>();
  for (const pair of review.pairs) {
    if (review.resolutions[pair.id] != null) continue;
    pendingNameKeys.add(importPlayerNameKey(pair.sportKey, pair.left.nameKey));
    pendingNameKeys.add(importPlayerNameKey(pair.sportKey, pair.right.nameKey));
  }

  let catalogMatches = 0;
  let newNames = 0;
  for (const name of review.names) {
    if (name.exactMatchId) {
      catalogMatches += 1;
      continue;
    }
    if (pendingNameKeys.has(name.key)) continue;
    newNames += 1;
  }

  return {
    uniqueNames: review.names.length,
    catalogMatches,
    newNames,
    pendingPairs: countPendingPlayerReviewPairs(review),
  };
}

export function resolveImportPlayerReviewPair(
  session: Dm2ImportSession,
  pairIdValue: string,
  resolution: Dm2PlayerPairResolution
): Dm2ImportSession {
  const review = mergeImportPlayerReview(session);
  return {
    ...session,
    playerReview: {
      ...review,
      resolutions: {
        ...review.resolutions,
        [pairIdValue]: resolution,
      },
    },
  };
}

export interface Dm2ImportPlayerCommitGroup {
  sportKey: string;
  sportLabel: string;
  sportId?: string;
  canonicalName: string;
  catalogPlayerId?: string;
  memberNames: string[];
  aliasNames: string[];
}

function findName(
  review: Dm2ImportPlayerReview,
  sportKey: string,
  nameKey: string
): Dm2ImportPlayerName | undefined {
  return review.names.find(
    (name) => name.sportKey === sportKey && name.nameKey === nameKey
  );
}

function importSideKey(
  review: Dm2ImportPlayerReview,
  sportKey: string,
  side: Dm2ImportPlayerReviewSide
): string | undefined {
  const name = findName(review, sportKey, side.nameKey);
  return name?.key;
}

export function buildPlayerCommitGroups(review: Dm2ImportPlayerReview): {
  error?: string;
  pendingPairCount: number;
  groups: Dm2ImportPlayerCommitGroup[];
} {
  const pendingPairCount = countPendingPlayerReviewPairs(review);
  if (pendingPairCount > 0) {
    return {
      error: `${pendingPairCount} player pair(s) still need a merge or keep-both decision.`,
      pendingPairCount,
      groups: [],
    };
  }

  const parent = new Map<string, string>();
  const rank = new Map<string, number>();
  const canonicalName = new Map<string, string>();
  const catalogPlayerId = new Map<string, string>();
  const members = new Map<string, Set<string>>();
  const sportByKey = new Map<string, { sportKey: string; sportLabel: string; sportId?: string }>();

  function ensure(name: Dm2ImportPlayerName) {
    if (!parent.has(name.key)) {
      parent.set(name.key, name.key);
      rank.set(name.key, 0);
      canonicalName.set(name.key, name.name);
      members.set(name.key, new Set([name.name]));
      sportByKey.set(name.key, {
        sportKey: name.sportKey,
        sportLabel: name.sportLabel,
        sportId: name.sportId,
      });
      if (name.exactMatchId) catalogPlayerId.set(name.key, name.exactMatchId);
    }
  }

  function find(key: string): string {
    const current = parent.get(key) ?? key;
    if (current === key) return key;
    const root = find(current);
    parent.set(key, root);
    return root;
  }

  function attachCatalog(root: string, playerId: string): string | undefined {
    const existing = catalogPlayerId.get(root);
    if (existing && existing !== playerId) {
      return "A player name matched two different catalog players. Keep both, or pick one catalog player to merge into.";
    }
    catalogPlayerId.set(root, playerId);
    return undefined;
  }

  function union(leftKey: string, rightKey: string, nextCanonical?: string) {
    const leftRoot = find(leftKey);
    const rightRoot = find(rightKey);
    if (leftRoot === rightRoot) {
      if (nextCanonical) canonicalName.set(leftRoot, nextCanonical);
      return;
    }
    const leftRank = rank.get(leftRoot) ?? 0;
    const rightRank = rank.get(rightRoot) ?? 0;
    const [root, child] =
      leftRank >= rightRank ? [leftRoot, rightRoot] : [rightRoot, leftRoot];
    parent.set(child, root);
    if (leftRank === rightRank) rank.set(root, leftRank + 1);
    for (const member of members.get(child) ?? []) {
      members.get(root)?.add(member);
    }
    if (nextCanonical) canonicalName.set(root, nextCanonical);
    else if (!canonicalName.has(root)) {
      canonicalName.set(root, canonicalName.get(child) ?? "");
    }
    const childCatalog = catalogPlayerId.get(child);
    if (childCatalog) {
      const conflict = attachCatalog(root, childCatalog);
      if (conflict) throw new Error(conflict);
    }
  }

  for (const name of review.names) {
    ensure(name);
  }

  try {
    for (const pair of review.pairs) {
      const resolution = review.resolutions[pair.id];
      if (!resolution || resolution.action === "keep_both") continue;

      const leftImportKey = importSideKey(review, pair.sportKey, pair.left);
      const rightImportKey = importSideKey(review, pair.sportKey, pair.right);
      const canonicalSide =
        resolution.canonicalSide === "left" ? pair.left : pair.right;
      const otherSide =
        resolution.canonicalSide === "left" ? pair.right : pair.left;

      if (leftImportKey && rightImportKey) {
        union(leftImportKey, rightImportKey, canonicalSide.name);
        const root = find(leftImportKey);
        const catalogId =
          pair.left.catalogPlayerId ?? pair.right.catalogPlayerId;
        if (catalogId) {
          const conflict = attachCatalog(root, catalogId);
          if (conflict) return { error: conflict, pendingPairCount, groups: [] };
        }
        continue;
      }

      const importKey = leftImportKey ?? rightImportKey;
      const catalogId =
        (leftImportKey ? pair.right.catalogPlayerId : pair.left.catalogPlayerId) ??
        otherSide.catalogPlayerId ??
        canonicalSide.catalogPlayerId;
      if (!importKey || !catalogId) continue;
      const root = find(importKey);
      const conflict = attachCatalog(root, catalogId);
      if (conflict) return { error: conflict, pendingPairCount, groups: [] };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to merge player names.",
      pendingPairCount,
      groups: [],
    };
  }

  const groupsByRoot = new Map<string, Dm2ImportPlayerCommitGroup>();
  for (const name of review.names) {
    const root = find(name.key);
    const sport = sportByKey.get(root) ?? sportByKey.get(name.key);
    if (!sport) continue;
    const existing = groupsByRoot.get(root);
    const groupCanonical = canonicalName.get(root) ?? name.name;
    if (!existing) {
      groupsByRoot.set(root, {
        sportKey: sport.sportKey,
        sportLabel: sport.sportLabel,
        sportId: sport.sportId ?? name.sportId,
        canonicalName: groupCanonical,
        catalogPlayerId: catalogPlayerId.get(root) ?? name.exactMatchId,
        memberNames: [name.name],
        aliasNames: [],
      });
      continue;
    }
    if (!existing.memberNames.includes(name.name)) {
      existing.memberNames.push(name.name);
    }
    if (!existing.catalogPlayerId && name.exactMatchId) {
      existing.catalogPlayerId = name.exactMatchId;
    }
  }

  for (const group of groupsByRoot.values()) {
    const canonicalKey = normalizePlayerNameKey(group.canonicalName);
    if (group.catalogPlayerId) {
      group.aliasNames = [...group.memberNames];
    } else {
      group.aliasNames = group.memberNames.filter(
        (member) => normalizePlayerNameKey(member) !== canonicalKey
      );
    }
  }

  return {
    pendingPairCount: 0,
    groups: [...groupsByRoot.values()].sort(
      (a, b) =>
        a.sportLabel.localeCompare(b.sportLabel) ||
        a.canonicalName.localeCompare(b.canonicalName)
    ),
  };
}

export function commitPlayersReviewStep(
  session: Dm2ImportSession
): { session?: Dm2ImportSession; error?: string } {
  if (!session.reviewProgress?.lookupsCommittedAt) {
    return {
      error: "Commit the lookup review step before committing players.",
    };
  }

  const review = mergeImportPlayerReview(session);
  const pending = countPendingPlayerReviewPairs(review);
  if (pending > 0) {
    return {
      error: `${pending} player pair(s) still need a merge or keep-both decision.`,
    };
  }

  const plan = buildPlayerCommitGroups(review);
  if (plan.error) {
    return { error: plan.error };
  }

  return {
    session: {
      ...session,
      playerReview: review,
      reviewProgress: {
        lookupsCommittedAt: session.reviewProgress.lookupsCommittedAt,
        playersCommittedAt: new Date().toISOString(),
      },
    },
  };
}
