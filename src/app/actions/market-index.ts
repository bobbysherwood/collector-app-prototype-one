"use server";

import { revalidatePath } from "next/cache";
import { computeSportMarketIndex } from "@/lib/market-index/engine/compute-sport-index";
import {
  getCachedSportMarketIndex,
  getLatestSportMarketIndexSnapshot,
  upsertSportMarketIndexCache,
} from "@/lib/market-index-cache";
import {
  getLatestSportMarketFeatures,
  getSportMarketIndexConfig,
  getSportMarketIndexConfigsWithMeta,
  insertSportMarketIndexSnapshot,
  upsertSportMarketFeatures,
} from "@/lib/market-index-data";
import { getUserProfile } from "@/lib/data";
import type { SportMarketIndexConfig, SportMarketIndexResult } from "@/types/market-index";
import { isAdminRole } from "@/types/user";

async function requireAuthenticatedUser() {
  const profile = await getUserProfile();
  if (!profile) {
    return { error: "You must be signed in." as const };
  }
  return { profile };
}

async function requireAdminUser() {
  const auth = await requireAuthenticatedUser();
  if ("error" in auth) return auth;
  if (!isAdminRole(auth.profile.role)) {
    return { error: "Admin access required." as const };
  }
  return auth;
}

export interface SportMarketIndexResponse {
  error?: string;
  result?: SportMarketIndexResult;
  fromCache?: boolean;
  cachedAt?: string;
}

export interface SportMarketIndexAdminMeta {
  configs: SportMarketIndexConfig[];
  usingDefaults: boolean;
  latestBySportId: Record<
    string,
    { result: SportMarketIndexResult; computedAt: string } | null
  >;
}

export async function getSportMarketIndexAdminMeta(): Promise<SportMarketIndexAdminMeta> {
  const { configs, usingDefaults } = await getSportMarketIndexConfigsWithMeta();
  const latestBySportId: SportMarketIndexAdminMeta["latestBySportId"] = {};

  for (const config of configs) {
    const cached = await getCachedSportMarketIndex(config.id);
    if (cached) {
      latestBySportId[config.id] = {
        result: cached.result,
        computedAt: cached.fetchedAt,
      };
      continue;
    }

    const snapshot = await getLatestSportMarketIndexSnapshot(config.id);
    latestBySportId[config.id] = snapshot
      ? {
          result: {
            ...snapshot.result,
            sportName: config.name,
          },
          computedAt: snapshot.computedAt,
        }
      : null;
  }

  return { configs, usingDefaults, latestBySportId };
}

export async function getSportMarketIndex(
  sportId: string
): Promise<SportMarketIndexResponse> {
  const auth = await requireAuthenticatedUser();
  if ("error" in auth) return { error: auth.error };

  const config = await getSportMarketIndexConfig(sportId);
  if (!config || !config.active) {
    return { error: "Sport market index is not configured." };
  }

  const cached = await getCachedSportMarketIndex(sportId);
  if (cached) {
    return {
      result: { ...cached.result, sportName: config.name },
      fromCache: true,
      cachedAt: cached.fetchedAt,
    };
  }

  const snapshot = await getLatestSportMarketIndexSnapshot(sportId);
  if (snapshot) {
    return {
      result: { ...snapshot.result, sportName: config.name },
      fromCache: false,
      cachedAt: snapshot.computedAt,
    };
  }

  return { error: "No sport market index has been computed yet." };
}

export async function refreshSportMarketIndex(
  sportId: string
): Promise<SportMarketIndexResponse> {
  const auth = await requireAdminUser();
  if ("error" in auth) return { error: auth.error };

  const config = await getSportMarketIndexConfig(sportId);
  if (!config || !config.active) {
    return { error: "Sport market index is not configured." };
  }

  const priorFeatures = await getLatestSportMarketFeatures(
    sportId,
    new Date().toISOString().slice(0, 10)
  );
  const computed = await computeSportMarketIndex({
    config,
    priorFeatures,
  });

  if (computed.error || !computed.result) {
    return { error: computed.error ?? "Sport market index computation failed." };
  }

  const observedAt = computed.result.asOf.slice(0, 10);

  if (computed.observations?.length) {
    await upsertSportMarketFeatures({
      sportId,
      observedAt,
      observations: computed.observations,
    });
  }

  await insertSportMarketIndexSnapshot({
    sportId,
    result: computed.result,
  });

  const cachedAt = await upsertSportMarketIndexCache({
    sportId,
    result: computed.result,
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");

  return {
    result: computed.result,
    fromCache: false,
    cachedAt: cachedAt ?? computed.result.asOf,
  };
}
