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
  active: boolean;
  createdAt: string;
}
