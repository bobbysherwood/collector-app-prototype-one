"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  countPendingPlayerReviewPairs,
  countRowsMissingPlayer,
  mergeImportPlayerReview,
  resolveImportPlayerReviewPair,
  summarizeImportPlayerReview,
} from "@/lib/dm2-import-players";
import type { Dm2ImportSession, Dm2PlayerPairResolution } from "@/types/dm2-import";

function sideLabel(side: {
  name: string;
  catalogPlayerId?: string;
}): string {
  return side.catalogPlayerId ? `Catalog: ${side.name}` : side.name;
}

export function Dm2ImportReviewPlayers({
  session,
  onSessionChange,
}: {
  session: Dm2ImportSession;
  onSessionChange: (updater: (session: Dm2ImportSession) => Dm2ImportSession) => void;
}) {
  const review = mergeImportPlayerReview(session);
  const summary = summarizeImportPlayerReview(review);
  const pendingPairs = countPendingPlayerReviewPairs(review);
  const missingPlayerRows = countRowsMissingPlayer(session);
  const unresolvedPairs = review.pairs.filter(
    (pair) => review.resolutions[pair.id] == null
  );

  function resolvePair(pairId: string, resolution: Dm2PlayerPairResolution) {
    onSessionChange((current) =>
      resolveImportPlayerReviewPair(current, pairId, resolution)
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Match file player names to catalog players in the same sport. Exact names
        reuse the existing UUID. Names below 90% similar are created as new
        players. Names between 90% and 99% similar need a merge or keep-both
        decision. Combo cards split on /.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Unique names</p>
          <p className="text-lg font-semibold">{summary.uniqueNames}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Catalog matches</p>
          <p className="text-lg font-semibold">{summary.catalogMatches}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">New players</p>
          <p className="text-lg font-semibold">{summary.newNames}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Pairs to review</p>
          <p
            className={
              pendingPairs > 0
                ? "text-lg font-semibold text-destructive"
                : "text-lg font-semibold"
            }
          >
            {pendingPairs}
          </p>
        </div>
      </div>

      {missingPlayerRows > 0 && (
        <p className="text-xs text-muted-foreground">
          {missingPlayerRows} row(s) have no player name. Those still need a
          player on the cards step.
        </p>
      )}

      {unresolvedPairs.length > 0 ? (
        <div className="max-h-96 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sport</TableHead>
                <TableHead>Name A</TableHead>
                <TableHead>Name B</TableHead>
                <TableHead className="text-right">Match</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unresolvedPairs.map((pair) => (
                <TableRow key={pair.id}>
                  <TableCell>{pair.sportLabel}</TableCell>
                  <TableCell>{sideLabel(pair.left)}</TableCell>
                  <TableCell>{sideLabel(pair.right)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.round(pair.similarity * 100)}%
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          resolvePair(pair.id, {
                            action: "merge",
                            canonicalSide: "left",
                          })
                        }
                      >
                        Merge as A
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          resolvePair(pair.id, {
                            action: "merge",
                            canonicalSide: "right",
                          })
                        }
                      >
                        Merge as B
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          resolvePair(pair.id, { action: "keep_both" })
                        }
                      >
                        Keep both
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {summary.uniqueNames === 0
            ? "No player names found on included rows."
            : `All close matches are resolved. ${summary.catalogMatches} will link to catalog players and ${summary.newNames} will be created.`}
        </p>
      )}

      {review.names.length > 0 && unresolvedPairs.length === 0 && (
        <div className="max-h-64 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sport</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {review.names.map((name) => (
                <TableRow key={name.key}>
                  <TableCell>{name.sportLabel}</TableCell>
                  <TableCell>{name.name}</TableCell>
                  <TableCell className="tabular-nums">{name.rowCount}</TableCell>
                  <TableCell>
                    {name.exactMatchId ? (
                      <Badge variant="secondary">Catalog</Badge>
                    ) : (
                      <Badge>New</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
