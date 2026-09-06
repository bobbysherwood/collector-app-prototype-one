import type { Asset } from "@/types/asset";
import type { CardArchetype } from "@/types/card-investment";
import { classifyPlayerLifecycle } from "@/lib/card-investment/classification/player-lifecycle";

export function classifyCardArchetype(asset: Asset, asOfYear?: number): CardArchetype {
  const cardType = asset.card_type.toLowerCase();
  const parallel = (asset.insert_parallel ?? "").toLowerCase();

  if (cardType.includes("rookie") || cardType.includes("rc")) {
    return "rookie";
  }

  if (
    cardType.includes("auto") ||
    cardType.includes("signature") ||
    parallel.includes("auto")
  ) {
    return "auto";
  }

  if (
    cardType.includes("patch") ||
    cardType.includes("mem") ||
    cardType.includes("relic")
  ) {
    return "memorabilia";
  }

  if (parallel && parallel !== "base" && parallel !== "") {
    return "parallel";
  }

  if (classifyPlayerLifecycle(asset, asOfYear) === "legacy") {
    return "hof_legacy";
  }

  if (cardType.includes("base")) {
    return "base";
  }

  return "unknown";
}
