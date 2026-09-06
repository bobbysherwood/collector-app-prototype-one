/**
 * Current investment-model behavior after the second improvement pass.
 */
export const MODEL_DESIGN_NOTES = [
  "Player futureOutlookScore blends lifecycle, performance, injury, and player age when birth year is available.",
  "Player momentumScore blends discussion growth, search, career strength, and a smaller sport-momentum term.",
  "Player Opportunity does not attach card fair value. Card price lives only on Player/Card Opportunity.",
  "Current market value is the latest in-window sale, or the 7-day median when several recent prints exist.",
  "Fair-value windows exclude that latest print when other comps exist.",
  "Expected 90-day return is mispricing mean-reversion plus sport forecast, with a damped residual forecast.",
  "PlayerCardOpportunity.riskScore is permanent-loss risk. playerRiskScore, volatilityScore, and uncertaintyScore are separate.",
  "Scarcity uses metadata plus inferred or explicit graded population and population growth. No live PSA API is called in tests.",
  "Seasonality uses seasonPhase plus a calendar overlay scaled by era (pre-war through ultra-modern).",
  "Recommendation thresholds are strongBuy 80 / buy 65 / hold 45 / sell 30, then confidence and mispricing constraints.",
  "Lifecycle prefers an explicit player profile (career status / birth year) over name-list heuristics.",
  "Card-opportunity weights are frozen calibrated-v2 values fit conceptually on the validation split, never holdout.",
  "Observed-sales backtests replay sale tapes with sale_date <= asOf. Synthetic mean-reversion remains a separate experiment.",
] as const;
