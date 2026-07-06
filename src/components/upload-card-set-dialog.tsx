"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { importCardRepositoryEntries } from "@/app/actions/card-repository";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CARD_REPOSITORY_IMPORT_COLUMNS,
  parseCardRepositoryExcel,
} from "@/lib/card-repository-import";

const REQUIRED_COLUMNS = CARD_REPOSITORY_IMPORT_COLUMNS.slice(0, 8);
const OPTIONAL_COLUMNS = CARD_REPOSITORY_IMPORT_COLUMNS.slice(8);
const OPTIONAL_COLUMN_SET = new Set<string>(OPTIONAL_COLUMNS);

export function UploadCardSetDialog() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importDetails, setImportDetails] = useState<string[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  function resetState() {
    setError(null);
    setImportMessage(null);
    setImportDetails([]);
    setSelectedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    setError(null);
    setImportMessage(null);
    setImportDetails([]);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseCardRepositoryExcel(buffer);

      if (parsed.errors.length > 0 && parsed.entries.length === 0) {
        setError("The Excel file could not be imported.");
        setImportDetails(parsed.errors);
        setImporting(false);
        return;
      }

      const result = await importCardRepositoryEntries(parsed.entries);

      if (result.error && (result.imported ?? 0) === 0) {
        setError(result.error);
        setImportDetails([...parsed.errors, ...(result.rowErrors ?? [])]);
        setImporting(false);
        return;
      }

      const messages = [
        `Imported ${result.imported ?? 0} card${result.imported === 1 ? "" : "s"}.`,
      ];
      if ((result.skipped ?? 0) > 0) {
        messages.push(`Skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}.`);
      }

      setImportMessage(messages.join(" "));
      setImportDetails([...parsed.errors, ...(result.rowErrors ?? [])]);

      if ((result.imported ?? 0) > 0) {
        router.refresh();
      }
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Failed to read the Excel file."
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSelectedFileName(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!importing) {
          setOpen(nextOpen);
          if (!nextOpen) resetState();
        }
      }}
    >
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Card Set
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Card Set</DialogTitle>
          <DialogDescription>
            Import cards into the repository from an Excel spreadsheet.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4 text-sm">
          <div>
            <h3 className="font-medium">File requirements</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Accepted file types: <span className="text-foreground">.xlsx</span> and <span className="text-foreground">.xls</span></li>
              <li>Use the first worksheet in the workbook</li>
              <li>The first row may be a header row (recommended)</li>
              <li>Empty rows are ignored</li>
              <li>Up to 5,000 card rows per upload</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium">Column format</h3>
            <p className="mt-1 text-muted-foreground">
              Columns must appear in this exact order, left to right:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              {CARD_REPOSITORY_IMPORT_COLUMNS.map((column) => (
                <li key={column}>
                  <span className="text-foreground">{column}</span>
                  {OPTIONAL_COLUMN_SET.has(column) ? " (optional)" : " (required)"}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="font-medium">Validation rules</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Required fields: {REQUIRED_COLUMNS.join(", ")}
              </li>
              <li>
                Optional fields: {OPTIONAL_COLUMNS.join(", ")}
              </li>
              <li>
                Each row must be unique across Category, Year, Manufacturer, Brand,
                Card Set, Card Number, Player, and Parallel
              </li>
              <li>Duplicate rows in the file or database are skipped during import</li>
              <li>A unique card ID is generated automatically for each new row</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Select file</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setSelectedFileName(file?.name ?? null);
                setImportMessage(null);
                setImportDetails([]);
                setError(null);
              }}
            />
            <Button
              type="button"
              className="gap-2 sm:shrink-0"
              disabled={importing || !selectedFileName}
              onClick={async () => {
                const file = fileInputRef.current?.files?.[0];
                if (file) {
                  await handleImport(file);
                }
              }}
            >
              <Upload className="h-4 w-4" />
              {importing ? "Uploading..." : "Upload"}
            </Button>
          </div>
          {selectedFileName && (
            <p className="text-xs text-muted-foreground">Selected: {selectedFileName}</p>
          )}
          {importMessage && <p className="text-sm text-primary">{importMessage}</p>}
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {importDetails.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-lg border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
            {importDetails.map((detail) => (
              <p key={detail}>{detail}</p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
