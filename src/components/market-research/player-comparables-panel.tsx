"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ResearchEmptyState,
  ResearchPanel,
} from "@/components/market-research/research-shared";
import type { PlayerComparablePreview } from "@/lib/market-research/player-comparables";

export function PlayerComparablesPanel({
  comparables,
}: {
  comparables: PlayerComparablePreview[];
}) {
  return (
    <ResearchPanel title="Comparables">
      {comparables.length === 0 ? (
        <ResearchEmptyState>
          No same-sport catalog peers are available yet. Comparables use player
          profile fields and linked-card counts, not play-style similarity.
        </ResearchEmptyState>
      ) : (
        <>
          <ol className="space-y-3">
            {comparables.map((player, index) => (
              <li key={player.playerId}>
                <Link
                  href={player.href}
                  className="flex items-start gap-3 rounded-xl p-1 hover:bg-muted/50"
                >
                  <span className="mt-2 w-5 text-sm font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="relative mt-0.5 size-10 overflow-hidden rounded-full bg-muted">
                    {player.imageUrl ? (
                      <Image
                        src={player.imageUrl}
                        alt={player.playerName}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-sm font-semibold">
                        {player.playerName.charAt(0)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {player.playerName}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {player.matchScore}% match
                      </span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {player.reasons.map((reason) => (
                        <Badge key={reason.key} variant="secondary" className="text-[11px]">
                          {reason.label}
                        </Badge>
                      ))}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Investment peers from the same sport in the catalog. Match percent uses
            career stage, birth year, team, draft window, and nearby opportunity
            when those fields exist — not on-court style or live stats for every
            peer.
          </p>
        </>
      )}
    </ResearchPanel>
  );
}
