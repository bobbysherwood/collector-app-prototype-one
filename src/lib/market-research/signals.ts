import type { PlayerCardRecommendation } from "@/types/player-opportunity";

export type ResearchSignalTone = "positive" | "neutral" | "caution" | "negative";

export function scoreLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 60) return "Positive";
  if (score >= 45) return "Neutral";
  return "Weak";
}

export function scoreTone(score: number): ResearchSignalTone {
  if (score >= 60) return "positive";
  if (score >= 45) return "neutral";
  return "negative";
}

export function riskLabel(risk: "low" | "medium" | "high" | number): {
  label: string;
  score: number;
  tone: ResearchSignalTone;
} {
  if (typeof risk === "number") {
    if (risk <= 35) return { label: "Low", score: Math.round(risk / 10), tone: "positive" };
    if (risk <= 65)
      return { label: "Moderate", score: Math.round(risk / 10), tone: "caution" };
    return { label: "High", score: Math.round(risk / 10), tone: "negative" };
  }

  switch (risk) {
    case "low":
      return { label: "Low", score: 3, tone: "positive" };
    case "medium":
      return { label: "Moderate", score: 6, tone: "caution" };
    case "high":
      return { label: "High", score: 8, tone: "negative" };
  }
}

export function volatilityLabel(value: number): {
  label: string;
  tone: ResearchSignalTone;
} {
  if (value < 12) return { label: "Low", tone: "positive" };
  if (value < 22) return { label: "Medium", tone: "caution" };
  return { label: "High", tone: "negative" };
}

export function recommendationCopy(rec: PlayerCardRecommendation): {
  label: string;
  qualifier: string;
  tone: ResearchSignalTone;
} {
  switch (rec) {
    case "strong_buy":
      return { label: "Strong Buy", qualifier: "Strong Opportunity", tone: "positive" };
    case "buy":
      return { label: "Buy", qualifier: "Attractive Opportunity", tone: "positive" };
    case "hold":
      return { label: "Hold", qualifier: "Fairly Valued", tone: "neutral" };
    case "sell":
      return { label: "Sell", qualifier: "Limited Upside", tone: "caution" };
    case "strong_sell":
      return { label: "Strong Sell", qualifier: "Unattractive", tone: "negative" };
  }
}

export function toneClass(tone: ResearchSignalTone): string {
  switch (tone) {
    case "positive":
      return "text-emerald-600";
    case "caution":
      return "text-amber-600";
    case "negative":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

export function toneBgClass(tone: ResearchSignalTone): string {
  switch (tone) {
    case "positive":
      return "bg-emerald-500";
    case "caution":
      return "bg-amber-500";
    case "negative":
      return "bg-red-500";
    default:
      return "bg-muted-foreground/40";
  }
}

export function formatSignedPct(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}
