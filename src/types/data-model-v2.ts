export const DM2_CARD_SEARCH_PAGE_SIZE = 24;

export interface Dm2CardSetCategory {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Dm2CardSetName {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Dm2Manufacturer {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Dm2Brand {
  id: string;
  name: string;
  manufacturerId: string;
  manufacturerName: string;
  active: boolean;
  createdAt: string;
}

export interface Dm2Parallel {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Dm2Attribute {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Dm2CardAttributeAssignment {
  id: string;
  attributeId: string;
  attributeName: string;
}

export interface Dm2EntityDescription {
  entityKey: string;
  title: string;
  description: string;
  tableName?: string;
  sortOrder: number;
}

export interface Dm2CardSet {
  id: string;
  sportId: string;
  sportName: string;
  year: number;
  brandId: string;
  brandName: string;
  manufacturerName: string;
  cardSetCategoryId: string;
  cardSetCategoryName: string;
  cardSetNameId: string;
  cardSetName: string;
  active: boolean;
  createdAt: string;
}

export interface Dm2Card {
  id: string;
  cardSetId: string;
  cardSetLabel: string;
  cardNumber: string;
  player: string;
  parallelId: string | null;
  parallelName: string | null;
  imagePath: string | null;
  attributes: Dm2CardAttributeAssignment[];
  active: boolean;
  createdAt: string;
}

export interface Dm2CardSearchResult {
  id: string;
  cardSetId: string;
  sportName: string;
  year: number;
  manufacturerName: string;
  brandName: string;
  cardSetCategoryName: string;
  cardSetName: string;
  cardNumber: string;
  player: string;
  parallelName: string | null;
  imagePath: string | null;
  attributeNames: string[];
}

export interface Dm2PlayerSearchResult {
  player: string;
  cardCount: number;
}

export interface Dm2SportSearchResult {
  sport: string;
  cardSetCount: number;
  cardCount: number;
}

export type MarketResearchSearchSelection =
  | { type: "card"; card: Dm2CardSearchResult }
  | { type: "player"; player: Dm2PlayerSearchResult }
  | { type: "sport"; sport: Dm2SportSearchResult };

export interface Dm2CardFormLookupItem {
  id: string;
  name: string;
}

export interface Dm2CardFormBrandLookup extends Dm2CardFormLookupItem {
  manufacturerId: string;
}

export interface Dm2CardFormLookups {
  manufacturers: Dm2CardFormLookupItem[];
  brands: Dm2CardFormBrandLookup[];
  cardSetCategories: Dm2CardFormLookupItem[];
  cardSetNames: Dm2CardFormLookupItem[];
  parallels: Dm2CardFormLookupItem[];
}

export const EMPTY_DM2_CARD_FORM_LOOKUPS: Dm2CardFormLookups = {
  manufacturers: [],
  brands: [],
  cardSetCategories: [],
  cardSetNames: [],
  parallels: [],
};
