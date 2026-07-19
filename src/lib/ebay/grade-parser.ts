import type { Grader } from "@/types/asset";
import { gradeLabel } from "@/types/card";

export interface ParsedListingGrade {
  grader: Grader;
  grade: string | null;
}

const RAW_PATTERN =
  /\b(raw|ungraded|un-graded|unslabbed|no grade)\b/i;

const GRADER_PATTERNS: {
  grader: Grader;
  pattern: RegExp;
}[] = [
  { grader: "PSA", pattern: /\bPSA\s*(?:GEM\s*)?(?:MT)?\s*(\d+(?:\.\d+)?)\b/i },
  { grader: "BGS", pattern: /\bBGS\s*(\d+(?:\.\d+)?)\b/i },
  { grader: "SGC", pattern: /\bSGC\s*(\d+(?:\.\d+)?)\b/i },
  { grader: "CGC", pattern: /\bCGC\s*(\d+(?:\.\d+)?)\b/i },
];

export function parseListingGradeFromTitle(title: string): ParsedListingGrade {
  for (const { grader, pattern } of GRADER_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      return { grader, grade: match[1] ?? null };
    }
  }

  if (RAW_PATTERN.test(title)) {
    return { grader: "Raw", grade: null };
  }

  if (/\b(PSA|BGS|SGC|CGC)\b/i.test(title)) {
    const grader = title.match(/\b(PSA|BGS|SGC|CGC)\b/i)?.[1]?.toUpperCase() as
      | Grader
      | undefined;
    if (grader) {
      return { grader, grade: null };
    }
  }

  return { grader: "Raw", grade: null };
}

export function listingGradeFilterKey(
  grader: Grader | null,
  grade: string | null
): string {
  if (!grader || grader === "Raw" || grader === "Ungraded") {
    return "Raw";
  }

  return gradeLabel({
    grader,
    grade,
    cert_number: null,
  });
}
