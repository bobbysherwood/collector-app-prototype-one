export type PopulationGrader = "PSA" | "BGS" | "SGC" | "CGC";

export type PopulationMatchDecision = "auto" | "review" | "reject";

export interface CatalogCardIdentity {
  id?: string;
  sportName: string;
  year: number;
  manufacturerName: string;
  brandName: string;
  cardSetName: string;
  cardNumber: string;
  player: string;
  parallelName?: string | null;
}

export interface GraderPopCandidate {
  grader: PopulationGrader;
  setName: string;
  year?: number | null;
  cardNumber: string;
  subject: string;
  variety: string;
  sourceUrl?: string;
  counts: Record<string, number | null>;
}

export interface PopulationMatchBreakdown {
  year: boolean;
  cardNumber: boolean;
  playerScore: number;
  setScore: number;
  brandScore: number;
  parallelOk: boolean;
}

export interface PopulationMatchResult {
  decision: PopulationMatchDecision;
  confidence: number;
  reasons: string[];
  breakdown: PopulationMatchBreakdown;
  candidate: GraderPopCandidate;
}

export interface PopulationLookupQuery {
  grader: PopulationGrader;
  q: string;
  url: string;
}
