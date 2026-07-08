export type PickListCategory = "card_type" | "sport" | "grader" | "grade";

export interface PickListOption {
  id: string;
  category: PickListCategory;
  label: string;
  active: boolean;
  sortOrder: number;
}

export interface ActivePickLists {
  cardTypes: string[];
  sports: string[];
  graders: string[];
  grades: string[];
}

export type AdminPickLists = Record<PickListCategory, PickListOption[]>;

export const PICK_LIST_CATEGORY_LABELS: Record<PickListCategory, string> = {
  card_type: "Card Type",
  sport: "Sport",
  grader: "Grader",
  grade: "Grade",
};

export const PICK_LIST_CATEGORIES: PickListCategory[] = [
  "card_type",
  "sport",
  "grader",
  "grade",
];

export const PICK_LIST_CATEGORIES_ALPHABETICAL: PickListCategory[] = [
  ...PICK_LIST_CATEGORIES,
].sort((a, b) =>
  PICK_LIST_CATEGORY_LABELS[a].localeCompare(PICK_LIST_CATEGORY_LABELS[b])
);
