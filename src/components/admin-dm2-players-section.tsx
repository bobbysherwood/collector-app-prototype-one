"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, ImagePlus, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import {
  autoCreateUnambiguousDm2Players,
  createDm2Player,
  deleteDm2Player,
  fillMissingDm2PlayerProfiles,
  getDm2PlayerMatchPlan,
  linkDm2CardPlayersBatch,
  refreshDm2PlayerBackfillBatch,
  resolveDm2PlayerReviewPair,
  setDm2PlayerActive,
  startDm2PlayerBackfillRefresh,
  updateDm2Player,
  uploadDm2PlayerImage,
} from "@/app/actions/data-model-v2";
import { ImageUpload } from "@/components/image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDm2PlayerImageUrl } from "@/lib/images";
import { sortPickListOptions } from "@/lib/pick-list-utils";
import {
  DM2_CAREER_STATUSES,
  DM2_INJURY_STATUSES,
} from "@/lib/dm2-player-profile";
import type { Dm2Player, Dm2PlayerReviewPair } from "@/types/data-model-v2";
import type { PickListOption } from "@/types/pick-list";

const PROFILE_UNSET = "__none__";

export function AdminDm2PlayersSection({
  players,
  sports,
}: {
  players: Dm2Player[];
  sports: PickListOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sportId, setSportId] = useState(sports[0]?.id ?? "");
  const [name, setName] = useState("");
  const [editRow, setEditRow] = useState<Dm2Player | null>(null);
  const [editSportId, setEditSportId] = useState("");
  const [editName, setEditName] = useState("");
  const [editBirthYear, setEditBirthYear] = useState("");
  const [editCareerStatus, setEditCareerStatus] = useState(PROFILE_UNSET);
  const [editInjuryStatus, setEditInjuryStatus] = useState(PROFILE_UNSET);
  const [editTeam, setEditTeam] = useState("");
  const [deleteRow, setDeleteRow] = useState<Dm2Player | null>(null);
  const [imageRow, setImageRow] = useState<Dm2Player | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [catalogNameCount, setCatalogNameCount] = useState(0);
  const [autoCreateCount, setAutoCreateCount] = useState(0);
  const [pendingAutoCreateCount, setPendingAutoCreateCount] = useState(0);
  const [reviewPairs, setReviewPairs] = useState<Dm2PlayerReviewPair[]>([]);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [fillMessage, setFillMessage] = useState<string | null>(null);

  const sortedSports = useMemo(() => sortPickListOptions(sports), [sports]);
  const sortedPlayers = useMemo(
    () =>
      [...players].sort(
        (a, b) =>
          a.sportName.localeCompare(b.sportName) || a.name.localeCompare(b.name)
      ),
    [players]
  );
  const activePlayerCount = useMemo(
    () => sortedPlayers.filter((player) => player.active).length,
    [sortedPlayers]
  );
  const missingProfileCount = useMemo(
    () =>
      sortedPlayers.filter((player) => player.active && player.birthYear == null)
        .length,
    [sortedPlayers]
  );

  async function loadPlan(): Promise<number> {
    setPlanLoading(true);
    const result = await getDm2PlayerMatchPlan();
    setPlanLoading(false);
    if (result.error) {
      setPlanError(result.error);
      setReviewPairs([]);
      return 0;
    }
    const count = result.catalogNameCount ?? 0;
    setPlanError(null);
    setCatalogNameCount(count);
    setAutoCreateCount(result.autoCreateCount ?? 0);
    setPendingAutoCreateCount(result.pendingAutoCreateCount ?? 0);
    setReviewPairs(result.reviewPairs ?? []);
    return count;
  }

  useEffect(() => {
    void loadPlan();
  }, [players]);

  async function runCardLinkBatches() {
    let afterCardId: string | null = null;
    let processed = 0;
    let linksCreated = 0;
    while (true) {
      const batch = await linkDm2CardPlayersBatch({ afterCardId });
      if (batch.error) return batch;
      processed += batch.processed ?? 0;
      linksCreated += batch.linksCreated ?? 0;
      setProgress(
        `Linked ${linksCreated.toLocaleString()} card rows · scanned ${processed.toLocaleString()} cards…`
      );
      if (batch.done) break;
      afterCardId = batch.nextAfterCardId ?? null;
      if (!afterCardId) break;
    }
    return {};
  }

  async function handleLoadCatalogNames() {
    setWorking(true);
    setPlanError(null);
    setProgress("Reading catalog names…");
    const count = await loadPlan();
    if (count === 0) {
      setPlanError(
        "No catalog names yet. Run scripts/populate-player-backfill-candidates.sql in the SQL editor, then click Load catalog names."
      );
    }
    setProgress(null);
    setWorking(false);
  }

  async function handleRebuildCatalogNames() {
    setWorking(true);
    setPlanError(null);
    setProgress("Scanning catalog names…");
    const started = await startDm2PlayerBackfillRefresh();
    if (started.error) {
      setPlanError(started.error);
      setWorking(false);
      setProgress(null);
      return;
    }

    let afterCardId: string | null = null;
    let processed = 0;
    while (true) {
      const batch = await refreshDm2PlayerBackfillBatch({ afterCardId });
      if (batch.error) {
        setPlanError(
          /statement timeout/i.test(batch.error ?? "")
            ? "Catalog scan timed out. Run scripts/populate-player-backfill-candidates.sql in the SQL editor, refresh this page, then click Load catalog names."
            : batch.error
        );
        setWorking(false);
        setProgress(null);
        return;
      }
      processed += batch.processed ?? 0;
      setProgress(`Scanned ${processed.toLocaleString()} cards…`);
      if (batch.done) break;
      afterCardId = batch.nextAfterCardId ?? null;
      if (!afterCardId) break;
    }

    setProgress(null);
    setWorking(false);
    await loadPlan();
  }

  async function handleAutoCreateAndLink() {
    setWorking(true);
    setPlanError(null);
    setProgress("Creating unique players…");
    const created = await autoCreateUnambiguousDm2Players();
    if (created.error) {
      setPlanError(created.error);
      setWorking(false);
      setProgress(null);
      return;
    }
    setProgress("Linking cards to players…");
    const linked = await runCardLinkBatches();
    if (linked.error) {
      setPlanError(linked.error);
      setWorking(false);
      setProgress(null);
      return;
    }
    setProgress(null);
    setWorking(false);
    await loadPlan();
    router.refresh();
  }

  async function handleFillMissingProfiles() {
    setPending(true);
    setError(null);
    setFillMessage(null);
    const result = await fillMissingDm2PlayerProfiles();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const examined = result.examined ?? 0;
    const filled = result.filled ?? 0;
    const skipped = result.skipped ?? 0;
    setFillMessage(
      result.cached
        ? `Last fill is cached for 15 minutes: wrote ${filled}, skipped ${skipped} of ${examined}.`
        : examined === 0
          ? "No active players are missing a birth year."
          : `Filled ${filled} profile${filled === 1 ? "" : "s"} from Wikidata · skipped ${skipped} of ${examined}.`
    );
    router.refresh();
  }

  async function runAction(
    action: () => Promise<{ error?: string }>,
    onSuccess?: () => void
  ) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSuccess?.();
    router.refresh();
  }

  return (
    <>
    <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-sm font-medium">Players</h3>
            <p className="text-xs text-muted-foreground">
              {activePlayerCount} active · {sortedPlayers.length} total
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-4 border-t border-border/80 bg-background px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Source of truth for catalog and Market Research. Names are unique
            per sport and use exact checklist spelling.
          </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {fillMessage ? (
        <p className="text-sm text-muted-foreground">{fillMessage}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending || working}
          onClick={() => void handleFillMissingProfiles()}
        >
          Fill missing profiles
        </Button>
        <p className="text-xs text-muted-foreground">
          Writes birth year, team, and career status from Wikidata when the
          catalog name matches exactly. Does not overwrite existing values.
          {missingProfileCount > 0
            ? ` ${missingProfileCount.toLocaleString()} active player${missingProfileCount === 1 ? "" : "s"} missing a birth year.`
            : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
        <Select value={sportId} onValueChange={(value) => value && setSportId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sport" />
          </SelectTrigger>
          <SelectContent>
            {sortedSports.map((sport) => (
              <SelectItem key={sport.id} value={sport.id}>
                {sport.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Exact player name"
          disabled={pending}
        />
        <Button
          disabled={pending || !sportId || !name.trim()}
          onClick={() =>
            runAction(
              () => createDm2Player({ sportId, name }),
              () => setName("")
            )
          }
        >
          Add player
        </Button>
      </div>

      <details className="group/table overflow-hidden rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
          <div>
            <h4 className="text-sm font-medium">Player table</h4>
            <p className="text-xs text-muted-foreground">
              {sortedPlayers.length.toLocaleString()} rows
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/table:rotate-180" />
        </summary>
      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>UUID</TableHead>
              <TableHead>Sport</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Career</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPlayers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-muted-foreground">
                  No players yet. Approve catalog names below or add one here.
                </TableCell>
              </TableRow>
            ) : (
              sortedPlayers.map((player) => {
                const imageUrl = getDm2PlayerImageUrl(player.imagePath);
                return (
                  <TableRow key={player.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {player.id}
                    </TableCell>
                    <TableCell>{player.sportName}</TableCell>
                    <TableCell>{player.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {player.team || "—"}
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {player.careerStatus || "—"}
                    </TableCell>
                    <TableCell>
                      {imageUrl ? (
                        <div className="relative size-10 overflow-hidden rounded-md bg-muted">
                          <Image
                            src={imageUrl}
                            alt={player.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={player.active ? "secondary" : "outline"}>
                        {player.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setImageRow(player)}
                          aria-label={`Upload image for ${player.name}`}
                        >
                          <ImagePlus className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditRow(player);
                            setEditSportId(player.sportId);
                            setEditName(player.name);
                            setEditBirthYear(
                              player.birthYear != null ? String(player.birthYear) : ""
                            );
                            setEditCareerStatus(player.careerStatus ?? PROFILE_UNSET);
                            setEditInjuryStatus(player.injuryStatus ?? PROFILE_UNSET);
                            setEditTeam(player.team ?? "");
                          }}
                          aria-label={`Edit ${player.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            runAction(() =>
                              setDm2PlayerActive({
                                id: player.id,
                                active: !player.active,
                              })
                            )
                          }
                          aria-label={
                            player.active ? `Deactivate ${player.name}` : `Activate ${player.name}`
                          }
                        >
                          {player.active ? (
                            <PowerOff className="size-4" />
                          ) : (
                            <Power className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteRow(player)}
                          aria-label={`Delete ${player.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      </details>

      <div className="space-y-3 rounded-lg border border-dashed p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Catalog player matching</h4>
            <p className="text-xs text-muted-foreground">
              Exact names auto-share a UUID. Names under 90% similar auto-create.
              Names 90–99% similar need a merge or keep-both decision. First
              populate: run{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                scripts/populate-player-backfill-candidates.sql
              </code>{" "}
              in the SQL editor, then Load catalog names.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={working}
              onClick={() => void handleLoadCatalogNames()}
            >
              Load catalog names
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={working}
              onClick={() => void handleRebuildCatalogNames()}
            >
              Rescan catalog
            </Button>
            <Button
              size="sm"
              disabled={working || catalogNameCount === 0 || pendingAutoCreateCount === 0}
              onClick={() => void handleAutoCreateAndLink()}
            >
              Create unique players
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={working || sortedPlayers.length === 0}
              onClick={() => {
                void (async () => {
                  setWorking(true);
                  setPlanError(null);
                  setProgress("Linking cards to players…");
                  const linked = await runCardLinkBatches();
                  if (linked.error) {
                    setPlanError(
                      /statement timeout/i.test(linked.error)
                        ? "Card linking timed out. Run scripts/link-dm2-card-players.sql in the SQL editor, then refresh this page."
                        : linked.error
                    );
                  }
                  setProgress(null);
                  setWorking(false);
                  router.refresh();
                })();
              }}
            >
              Link cards
            </Button>
          </div>
        </div>
        {planError ? <p className="text-sm text-destructive">{planError}</p> : null}
        {progress ? <p className="text-sm text-muted-foreground">{progress}</p> : null}
        {planLoading ? (
          <p className="text-sm text-muted-foreground">Loading match plan…</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {catalogNameCount.toLocaleString()} catalog names ·{" "}
            {autoCreateCount.toLocaleString()} auto-create ·{" "}
            {pendingAutoCreateCount.toLocaleString()} still to create ·{" "}
            {reviewPairs.length.toLocaleString()} pairs to review
          </p>
        )}
        {reviewPairs.length > 0 ? (
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
                {reviewPairs.map((pair) => (
                  <TableRow key={`${pair.sportId}::${pair.leftKey}::${pair.rightKey}`}>
                    <TableCell>{pair.sportLabel}</TableCell>
                    <TableCell>{pair.leftName}</TableCell>
                    <TableCell>{pair.rightName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(pair.similarity * 100)}%
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={working}
                          onClick={() =>
                            runAction(
                              () =>
                                resolveDm2PlayerReviewPair({
                                  sportId: pair.sportId,
                                  leftName: pair.leftName,
                                  rightName: pair.rightName,
                                  action: "merge",
                                  canonicalName: pair.leftName,
                                }),
                              () => void loadPlan()
                            )
                          }
                        >
                          Merge as A
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={working}
                          onClick={() =>
                            runAction(
                              () =>
                                resolveDm2PlayerReviewPair({
                                  sportId: pair.sportId,
                                  leftName: pair.leftName,
                                  rightName: pair.rightName,
                                  action: "merge",
                                  canonicalName: pair.rightName,
                                }),
                              () => void loadPlan()
                            )
                          }
                        >
                          Merge as B
                        </Button>
                        <Button
                          size="sm"
                          disabled={working}
                          onClick={() =>
                            runAction(
                              () =>
                                resolveDm2PlayerReviewPair({
                                  sportId: pair.sportId,
                                  leftName: pair.leftName,
                                  rightName: pair.rightName,
                                  action: "keep_both",
                                }),
                              () => void loadPlan()
                            )
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
        ) : !planLoading && catalogNameCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            No remaining near-duplicate pairs.
          </p>
        ) : null}
      </div>
        </div>
      </details>
    </section>

      <Dialog open={editRow != null} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit player</DialogTitle>
            <DialogDescription>
              Keep the exact catalog spelling. Birth year, team, and career fields
              improve Market Research comparables.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select
                value={editSportId}
                onValueChange={(value) => value && setEditSportId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sport" />
                </SelectTrigger>
                <SelectContent>
                  {sortedSports.map((sport) => (
                    <SelectItem key={sport.id} value={sport.id}>
                      {sport.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-player-name">Name</Label>
              <Input
                id="edit-player-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-birth-year">Birth year</Label>
                <Input
                  id="edit-birth-year"
                  inputMode="numeric"
                  value={editBirthYear}
                  onChange={(event) => setEditBirthYear(event.target.value)}
                  placeholder="1998"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-team">Team</Label>
                <Input
                  id="edit-team"
                  value={editTeam}
                  onChange={(event) => setEditTeam(event.target.value)}
                  placeholder="Boston Celtics"
                />
              </div>
              <div className="space-y-2">
                <Label>Career status</Label>
                <Select
                  value={editCareerStatus}
                  onValueChange={(value) => value && setEditCareerStatus(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROFILE_UNSET}>Not set</SelectItem>
                    {DM2_CAREER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Injury status</Label>
                <Select
                  value={editInjuryStatus}
                  onValueChange={(value) => value && setEditInjuryStatus(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROFILE_UNSET}>Not set</SelectItem>
                    {DM2_INJURY_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !editRow}
              onClick={() => {
                if (!editRow) return;
                runAction(
                  () =>
                    updateDm2Player({
                      id: editRow.id,
                      sportId: editSportId,
                      name: editName,
                      birthYear: editBirthYear,
                      careerStatus:
                        editCareerStatus === PROFILE_UNSET ? null : editCareerStatus,
                      injuryStatus:
                        editInjuryStatus === PROFILE_UNSET ? null : editInjuryStatus,
                      team: editTeam,
                    }),
                  () => setEditRow(null)
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteRow != null} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete player</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteRow?.name}&quot;? Cards linked to this player must be
              unlinked first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !deleteRow}
              onClick={() => {
                if (!deleteRow) return;
                runAction(() => deleteDm2Player(deleteRow.id), () => setDeleteRow(null));
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={imageRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setImageRow(null);
            setImageFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Player image</DialogTitle>
            <DialogDescription>
              Shown on the Market Research player page for {imageRow?.name}.
            </DialogDescription>
          </DialogHeader>
          {imageRow ? (
            <ImageUpload
              key={imageRow.id}
              currentImageUrl={getDm2PlayerImageUrl(imageRow.imagePath)}
              onFileSelect={setImageFile}
            />
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImageRow(null);
                setImageFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={pending || !imageRow || !imageFile}
              onClick={() => {
                if (!imageRow || !imageFile) return;
                const formData = new FormData();
                formData.set("file", imageFile);
                void runAction(
                  () => uploadDm2PlayerImage(imageRow.id, formData),
                  () => {
                    setImageRow(null);
                    setImageFile(null);
                  }
                );
              }}
            >
              Save image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
