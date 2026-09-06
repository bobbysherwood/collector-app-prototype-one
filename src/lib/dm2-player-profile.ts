export const DM2_CAREER_STATUSES = [
  "prospect",
  "active",
  "retired",
  "deceased",
] as const;

export const DM2_INJURY_STATUSES = ["healthy", "injured"] as const;

export type Dm2CareerStatus = (typeof DM2_CAREER_STATUSES)[number];
export type Dm2InjuryStatus = (typeof DM2_INJURY_STATUSES)[number];

export const DM2_PLAYER_TEAM_MAX_LENGTH = 80;

export interface Dm2PlayerProfileInput {
  birthYear?: number | string | null;
  careerStatus?: string | null;
  injuryStatus?: string | null;
  team?: string | null;
}

export interface Dm2PlayerProfileFields {
  birthYear: number | null;
  careerStatus: Dm2CareerStatus | null;
  injuryStatus: Dm2InjuryStatus | null;
  team: string | null;
}

export function isDm2CareerStatus(value: string): value is Dm2CareerStatus {
  return (DM2_CAREER_STATUSES as readonly string[]).includes(value);
}

export function isDm2InjuryStatus(value: string): value is Dm2InjuryStatus {
  return (DM2_INJURY_STATUSES as readonly string[]).includes(value);
}

export function normalizeDm2PlayerProfile(
  input: Dm2PlayerProfileInput
): { error?: string; profile?: Dm2PlayerProfileFields } {
  const rawYear =
    typeof input.birthYear === "string" ? input.birthYear.trim() : input.birthYear;
  let birthYear: number | null = null;
  if (rawYear !== "" && rawYear != null) {
    const year = typeof rawYear === "number" ? rawYear : Number(rawYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return { error: "Birth year must be between 1900 and 2100." };
    }
    birthYear = year;
  }

  const careerRaw = input.careerStatus?.trim() || "";
  if (careerRaw && !isDm2CareerStatus(careerRaw)) {
    return { error: "Career status is invalid." };
  }

  const injuryRaw = input.injuryStatus?.trim() || "";
  if (injuryRaw && !isDm2InjuryStatus(injuryRaw)) {
    return { error: "Injury status is invalid." };
  }

  const team = input.team?.trim() || "";
  if (team.length > DM2_PLAYER_TEAM_MAX_LENGTH) {
    return {
      error: `Team must be ${DM2_PLAYER_TEAM_MAX_LENGTH} characters or fewer.`,
    };
  }

  return {
    profile: {
      birthYear,
      careerStatus: careerRaw ? (careerRaw as Dm2CareerStatus) : null,
      injuryStatus: injuryRaw ? (injuryRaw as Dm2InjuryStatus) : null,
      team: team || null,
    },
  };
}

export function playerProfileToDbRow(profile: Dm2PlayerProfileFields) {
  return {
    birth_year: profile.birthYear,
    career_status: profile.careerStatus,
    injury_status: profile.injuryStatus,
    team: profile.team,
  };
}
