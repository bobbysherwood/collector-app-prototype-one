import { GRADES, SPORTS } from "@/lib/constants";
import type { CardFormData, Sport } from "@/types/card";
import type {
  NormalizedPsaCert,
  PsaCertApiPayload,
  PsaCertApiResponse,
  PsaCertIdentity,
} from "@/lib/psa/types";

const GRADE_VALUES = GRADES as readonly string[];

export function normalizePsaCertNumber(input: string): string | null {
  const digits = input.trim().replace(/[\s-]/g, "");
  if (!/^\d{4,16}$/.test(digits)) return null;
  return digits;
}

function readString(
  ...values: Array<string | number | null | undefined>
): string {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function readYear(
  ...values: Array<string | number | null | undefined>
): number | null {
  for (const value of values) {
    if (value == null || value === "") continue;
    const parsed =
      typeof value === "number" ? value : Number(String(value).match(/\b(19|20)\d{2}\b/)?.[0]);
    if (Number.isInteger(parsed) && parsed >= 1800 && parsed <= 2100) {
      return parsed;
    }
  }
  return null;
}

export function mapPsaCategoryToSport(category: string): Sport {
  const normalized = category.trim().toLowerCase();
  if (!normalized) return "Other";

  if (/\bpokemon|pokémon\b/.test(normalized)) return "Pokemon";
  if (/\bbasketball\b/.test(normalized)) return "Basketball";
  if (/\bfootball\b/.test(normalized) && !/\bsoccer\b/.test(normalized)) {
    return "Football";
  }
  if (/\bbaseball\b/.test(normalized)) return "Baseball";
  if (/\bhockey\b/.test(normalized)) return "Hockey";
  if (/\bsoccer\b/.test(normalized)) return "Soccer";

  const exact = SPORTS.find((sport) => sport.toLowerCase() === normalized);
  return exact ?? "Other";
}

export function mapPsaGrade(
  cardGrade: string,
  gradeDescription = "",
  grade = ""
): string {
  const raw = [cardGrade, gradeDescription, grade].filter(Boolean).join(" ");
  if (!raw.trim()) return "";

  if (/\bauthentic\b|\bauth\b/i.test(raw) && !/\b\d/.test(raw)) {
    return "Authentic";
  }

  const numeric = raw.match(/\b(\d{1,2}(?:\.\d)?)\b/);
  if (numeric) {
    const value = numeric[1]!;
    return GRADE_VALUES.includes(value) ? value : value;
  }

  if (/\bauthentic\b|\bauth\b/i.test(raw)) return "Authentic";
  return cardGrade.trim() || gradeDescription.trim() || grade.trim();
}

export function parsePsaCertPayload(
  payload: PsaCertApiPayload
): NormalizedPsaCert | null {
  const certNumber = normalizePsaCertNumber(
    readString(payload.CertNumber, payload.certNumber)
  );
  const subject = readString(payload.Subject, payload.subject);
  if (!certNumber || !subject) return null;

  const cardGrade = readString(payload.CardGrade, payload.cardGrade);
  const gradeDescription = readString(
    payload.GradeDescription,
    payload.gradeDescription
  );
  const gradeRaw = readString(payload.Grade, payload.grade);
  const category = readString(
    payload.Category,
    payload.category,
    payload.Sport,
    payload.sport
  );

  return {
    certNumber,
    subject,
    year: readYear(payload.Year, payload.year, payload.YearIssued, payload.yearIssued),
    cardNumber: readString(payload.CardNumber, payload.cardNumber).replace(/^#+/, ""),
    category,
    brand: readString(payload.Brand, payload.brand),
    variety: readString(payload.Variety, payload.variety),
    cardGrade,
    gradeDescription,
    grade: mapPsaGrade(cardGrade, gradeDescription, gradeRaw),
    sport: mapPsaCategoryToSport(category),
  };
}

export function interpretPsaCertResponse(
  status: number,
  body: unknown
):
  | { status: "found"; cert: NormalizedPsaCert }
  | { status: "not_found"; message: string }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string; retryable?: boolean } {
  if (status === 204) {
    return { status: "not_found", message: "That cert number was not found." };
  }
  if (status === 429) {
    return {
      status: "error",
      message: "PSA lookup is rate limited. Try again later.",
      retryable: true,
    };
  }
  if (status === 401) {
    return {
      status: "error",
      message: "PSA cert lookup is not available right now.",
    };
  }
  if (status === 403) {
    return {
      status: "error",
      message:
        "PSA rejected this API token. The free public cert API appears to have been shut down — email collectors-apis@collectors.com.",
    };
  }
  if (status >= 500) {
    return {
      status: "error",
      message: "PSA lookup is temporarily unavailable.",
      retryable: true,
    };
  }
  if (status === 400 || status === 404) {
    return {
      status: "invalid",
      message: "PSA did not recognize that cert number.",
    };
  }
  if (status < 200 || status >= 300) {
    return {
      status: "error",
      message: "PSA lookup is temporarily unavailable.",
      retryable: true,
    };
  }

  if (!body || typeof body !== "object") {
    return { status: "not_found", message: "That cert number was not found." };
  }

  const response = body as PsaCertApiResponse;
  const valid = response.IsValidRequest ?? response.isValidRequest;
  const message = (response.ServerMessage ?? response.serverMessage ?? "").trim();
  const payload = response.PSACert ?? response.psaCert ?? null;

  if (valid === false || /invalid cert/i.test(message)) {
    return {
      status: "invalid",
      message: "PSA did not recognize that cert number.",
    };
  }

  if (/no data found/i.test(message) || payload == null) {
    return { status: "not_found", message: "That cert number was not found." };
  }

  const cert = parsePsaCertPayload(payload);
  if (!cert) {
    return { status: "not_found", message: "That cert number was not found." };
  }

  return { status: "found", cert };
}

export function psaCertToFormPrefill(
  cert: NormalizedPsaCert
): Partial<CardFormData> {
  return {
    player_name: cert.subject,
    player_id: null,
    ...(cert.year != null ? { year: cert.year } : {}),
    sport: cert.sport,
    card_number: cert.cardNumber,
    grader: "PSA",
    grade: cert.grade,
    cert_number: cert.certNumber,
  };
}

export function psaCertIdentity(cert: NormalizedPsaCert): PsaCertIdentity {
  return {
    subject: cert.subject,
    year: cert.year,
    cardNumber: cert.cardNumber,
    brand: cert.brand,
    variety: cert.variety,
  };
}
