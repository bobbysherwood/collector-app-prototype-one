import type { Asset } from "@/types/asset";
import type { CardEra, CardSupplySignals } from "@/types/card-investment";

export function inferSupplyFromMetadata(
  asset: Asset,
  era: CardEra
): CardSupplySignals {
  const parallel = (asset.insert_parallel ?? "").toLowerCase();
  const match = parallel.match(/\/(\d+)/);
  if (match) {
    return { population: Number(match[1]), populationGrowthPct: 1 };
  }

  const cardType = asset.card_type.toLowerCase();
  const isBase = cardType.includes("base") || (!parallel && !cardType.includes("rookie"));

  if (era === "pre_war" || era === "vintage") {
    return { population: isBase ? 350 : 80, populationGrowthPct: 1 };
  }
  if (era === "junk_wax") {
    return {
      population: isBase ? 25000 : cardType.includes("rookie") ? 900 : 4000,
      populationGrowthPct: 4,
    };
  }
  if (era === "ultra_modern") {
    return {
      population: isBase ? 12000 : 800,
      populationGrowthPct: isBase ? 18 : 8,
    };
  }
  return {
    population: isBase ? 8000 : 600,
    populationGrowthPct: isBase ? 10 : 5,
  };
}

const MANUFACTURERS = [
  "Panini",
  "Topps",
  "Upper Deck",
  "Fleer",
  "Bowman",
  "Donruss",
  "Leaf",
];

export function inferManufacturer(asset: Asset): string {
  const haystack = `${asset.card_set_name ?? ""} ${asset.card_type}`;
  const found = MANUFACTURERS.find((name) =>
    haystack.toLowerCase().includes(name.toLowerCase())
  );
  return found ?? "unknown";
}
