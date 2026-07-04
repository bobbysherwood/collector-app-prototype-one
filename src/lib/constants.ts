import type { Grader, Sport } from "@/types/card";

export const SPORTS: Sport[] = [
  "Baseball",
  "Basketball",
  "Football",
  "Hockey",
  "Pokemon",
  "Soccer",
  "Other",
];

export const GRADERS: Grader[] = ["PSA", "BGS", "SGC", "CGC", "Raw", "Ungraded"];

export const GRADED_BY: Grader[] = ["PSA", "BGS", "SGC", "CGC"];

export const CARD_TYPES = [
  "Topps",
  "Topps Chrome",
  "Bowman",
  "Bowman Chrome",
  "Panini",
  "Select",
  "Mosaic",
  "Prizm",
  "Donruss",
  "Upper Deck",
  "Fleer",
  "Other",
] as const;

export const GRADES = [
  "10",
  "9.5",
  "9",
  "8.5",
  "8",
  "7.5",
  "7",
  "6.5",
  "6",
  "5",
  "4",
  "3",
  "2",
  "1",
  "Authentic",
] as const;
