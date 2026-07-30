"use client";

import { useRef, useState } from "react";
import { ChevronDown, Upload } from "lucide-react";
import { processDm2StructuredImportFile } from "@/app/actions/dm2-import";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  DM2_STRUCTURED_IMPORT_COLUMNS,
  DM2_STRUCTURED_IMPORT_OPTIONAL_COLUMNS,
  DM2_STRUCTURED_IMPORT_REQUIRED_COLUMNS,
} from "@/lib/dm2-structured-import";
import { DM2_IMPORT_MAX_FILE_BYTES } from "@/lib/dm2-import-file-content";
import type { Dm2ImportSession } from "@/types/dm2-import";

const OPTIONAL_COLUMN_SET = new Set<string>(
  DM2_STRUCTURED_IMPORT_OPTIONAL_COLUMNS
);

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function FormatHelpSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-border/80 py-2 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

export function Dm2StructuredUploadFormatRequirements() {
  return (
    <section className="rounded-xl border border-border/80 bg-muted/20 px-4 text-sm">
      <FormatHelpSection title="File requirements">
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Accepted file types:{" "}
            <span className="text-foreground">.xlsx</span> and{" "}
            <span className="text-foreground">.xls</span>
          </li>
          <li>Use the first worksheet in the workbook</li>
          <li>The first row may be a header row (recommended)</li>
          <li>Empty rows are ignored</li>
          <li>
            Maximum file size:{" "}
            {(DM2_IMPORT_MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB
          </li>
        </ul>
      </FormatHelpSection>

      <FormatHelpSection title="Column format">
        <p className="text-muted-foreground">
          Columns must appear in this exact order, left to right. Each row
          represents one card in Data Model v2.
        </p>
        <ol className="mt-3 space-y-2">
          {DM2_STRUCTURED_IMPORT_COLUMNS.map((column) => {
            const optional = OPTIONAL_COLUMN_SET.has(column);
            return (
              <li
                key={column}
                className="flex flex-wrap items-center gap-2 text-muted-foreground"
              >
                <span className="font-medium text-foreground">{column}</span>
                <Badge
                  variant={optional ? "outline" : "default"}
                  className="text-[10px] font-normal"
                >
                  {optional ? "Optional" : "Required"}
                </Badge>
              </li>
            );
          })}
        </ol>
      </FormatHelpSection>

      <FormatHelpSection title="Validation rules">
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <span className="text-foreground">Required:</span>{" "}
            {DM2_STRUCTURED_IMPORT_REQUIRED_COLUMNS.join(", ")}
          </li>
          <li>
            <span className="text-foreground">Optional:</span>{" "}
            {DM2_STRUCTURED_IMPORT_OPTIONAL_COLUMNS.join(", ")}
          </li>
          <li>
            Year must be a whole number between 1800 and 2100
          </li>
          <li>
            A Card Set is uniquely identified by Sport, Year, Brand, Card Set
            Category, and Card Set Name
          </li>
          <li>
            A Card is uniquely identified by Card Set, Card Number, Player, and
            Parallel
          </li>
          <li>
            After upload, rows enter the same review and commit flow as the AI
            Loader
          </li>
        </ul>
      </FormatHelpSection>
    </section>
  );
}

export function Dm2StructuredUploadDialog({
  disabled,
  onSessionReady,
}: {
  disabled?: boolean;
  onSessionReady: (session: Dm2ImportSession, error?: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  function resetState() {
    setError(null);
    setSelectedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension !== "xlsx" && extension !== "xls") {
        setError("Structured upload requires an Excel file (.xlsx or .xls).");
        return;
      }

      if (file.size > DM2_IMPORT_MAX_FILE_BYTES) {
        setError(
          `${file.name} exceeds the ${(DM2_IMPORT_MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB limit.`
        );
        return;
      }

      const buffer = await file.arrayBuffer();
      const result = await processDm2StructuredImportFile({
        fileName: file.name,
        mimeType: file.type || "application/vnd.ms-excel",
        contentBase64: arrayBufferToBase64(buffer),
      });

      if (result.error && !result.session) {
        setError(result.error);
        return;
      }

      if (result.session) {
        resetState();
        setOpen(false);
        onSessionReady(result.session, result.error ?? null);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to read the Excel file."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!uploading) {
          setOpen(nextOpen);
          if (!nextOpen) resetState();
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2" disabled={disabled}>
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Structured Excel</DialogTitle>
          <DialogDescription>
            Import cards using a fixed-column Excel template mapped directly to
            Data Model v2.
          </DialogDescription>
        </DialogHeader>

        <Dm2StructuredUploadFormatRequirements />

        <section className="space-y-3">
          <Label htmlFor="dm2-structured-upload-file">Select file</Label>
          <Input
            id="dm2-structured-upload-file"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setSelectedFileName(file?.name ?? null);
              setError(null);
            }}
          />
          {selectedFileName && (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedFileName}
            </p>
          )}
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="gap-2"
            disabled={uploading || !selectedFileName}
            onClick={async () => {
              const file = fileInputRef.current?.files?.[0];
              if (file) {
                await handleUpload(file);
              }
            }}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
