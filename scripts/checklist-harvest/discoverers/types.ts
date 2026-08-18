import type { ChecklistCatalogEntry } from "../catalog/types";

export interface DiscoverOptions {
  headed?: boolean;
  dryRun?: boolean;
  sport?: string;
  manufacturer?: string;
  maxEntries?: number;
  year?: string;
}

export interface IDiscoverer {
  readonly id: string;
  discover(options: DiscoverOptions): Promise<ChecklistCatalogEntry[]>;
}