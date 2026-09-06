import type { Sport } from "@/types/card";

export const PSA_PUBLIC_API_BASE = "https://api.psacard.com/publicapi";
export const PSA_CERT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PsaCertApiPayload {
  CertNumber?: string | number | null;
  certNumber?: string | number | null;
  Year?: string | number | null;
  year?: string | number | null;
  YearIssued?: string | number | null;
  yearIssued?: string | number | null;
  Brand?: string | null;
  brand?: string | null;
  Category?: string | null;
  category?: string | null;
  Sport?: string | null;
  sport?: string | null;
  CardNumber?: string | number | null;
  cardNumber?: string | number | null;
  Subject?: string | null;
  subject?: string | null;
  Variety?: string | null;
  variety?: string | null;
  CardGrade?: string | null;
  cardGrade?: string | null;
  GradeDescription?: string | null;
  gradeDescription?: string | null;
  Grade?: string | number | null;
  grade?: string | number | null;
}

export interface PsaCertApiResponse {
  IsValidRequest?: boolean;
  isValidRequest?: boolean;
  ServerMessage?: string | null;
  serverMessage?: string | null;
  PSACert?: PsaCertApiPayload | null;
  psaCert?: PsaCertApiPayload | null;
}

export interface NormalizedPsaCert {
  certNumber: string;
  subject: string;
  year: number | null;
  cardNumber: string;
  category: string;
  brand: string;
  variety: string;
  cardGrade: string;
  gradeDescription: string;
  grade: string;
  sport: Sport;
}

export type PsaCertLookupResult =
  | { status: "found"; cert: NormalizedPsaCert }
  | { status: "not_found"; message: string }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string; retryable?: boolean };

export interface PsaCertIdentity {
  subject: string;
  year: number | null;
  cardNumber: string;
  brand: string;
  variety: string;
}
