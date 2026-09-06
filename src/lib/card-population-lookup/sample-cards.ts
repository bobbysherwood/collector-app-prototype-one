import type { CatalogCardIdentity } from "@/lib/card-population-lookup/types";

/** Built-in identities so the POC runs without a database login. */
export const SAMPLE_POPULATION_CARDS: CatalogCardIdentity[] = [
  {
    id: "sample-wemby-base",
    sportName: "Basketball",
    year: 2023,
    manufacturerName: "Panini",
    brandName: "Prizm",
    cardSetName: "Prizm",
    cardNumber: "1",
    player: "Victor Wembanyama",
    parallelName: null,
  },
  {
    id: "sample-wemby-silver",
    sportName: "Basketball",
    year: 2023,
    manufacturerName: "Panini",
    brandName: "Prizm",
    cardSetName: "Prizm",
    cardNumber: "1",
    player: "Victor Wembanyama",
    parallelName: "Silver",
  },
  {
    id: "sample-miss",
    sportName: "Basketball",
    year: 2023,
    manufacturerName: "Panini",
    brandName: "Prizm",
    cardSetName: "Prizm",
    cardNumber: "1",
    player: "LeBron James",
    parallelName: null,
  },
];
