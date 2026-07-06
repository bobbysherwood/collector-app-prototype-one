export interface CardRepositoryEntryInput {
  category: string;
  year: number;
  manufacturer: string;
  brand: string;
  cardSetCategory: string;
  cardSet: string;
  cardNumber: string;
  player: string;
  parallel?: string;
  serialNumber?: number;
  releaseDate?: string;
}

export interface CardRepositorySetSummary {
  category: string;
  year: number;
  manufacturer: string;
  brand: string;
  cardSet: string;
  cards: number;
}

export interface CardRepositoryCard {
  id: string;
  cardSetCategory: string;
  cardNumber: string;
  player: string;
  parallel: string | null;
  serialNumber: number | null;
  releaseDate: string | null;
}

export interface CardRepositoryExportRow {
  category: string;
  year: number;
  manufacturer: string;
  brand: string;
  cardSetCategory: string;
  cardSet: string;
  cardNumber: string;
  player: string;
  parallel: string | null;
  serialNumber: number | null;
  releaseDate: string | null;
}

export type CardRepositorySetKey = Pick<
  CardRepositorySetSummary,
  "category" | "year" | "manufacturer" | "brand" | "cardSet"
>;

export const EMPTY_CARD_REPOSITORY_ENTRY: CardRepositoryEntryInput = {
  category: "",
  year: new Date().getFullYear(),
  manufacturer: "",
  brand: "",
  cardSetCategory: "",
  cardSet: "",
  cardNumber: "",
  player: "",
  parallel: "",
  serialNumber: undefined,
  releaseDate: "",
};
