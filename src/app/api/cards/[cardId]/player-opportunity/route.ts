import { NextResponse } from "next/server";
import { getPlayerOpportunityForCard } from "@/app/actions/player-opportunity";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params;
  const result = await getPlayerOpportunityForCard(cardId);

  if (result.error) {
    const status =
      result.error === "You must be signed in."
        ? 401
        : result.error === "Card not found."
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ opportunity: result.opportunity });
}
