import { processDm2ImportFiles } from "@/app/actions/dm2-import";
import {
  DM2_IMPORT_MAX_FILE_BYTES,
  DM2_IMPORT_MAX_FILES,
  DM2_IMPORT_MAX_TOTAL_BYTES,
} from "@/lib/dm2-import-file-content";
import type { Dm2ImportFileInput } from "@/types/dm2-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploaded = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    if (uploaded.length === 0) {
      return jsonError("Select at least one file to upload.");
    }

    if (uploaded.length > DM2_IMPORT_MAX_FILES) {
      return jsonError(
        `You can upload up to ${DM2_IMPORT_MAX_FILES} files per session.`
      );
    }

    let totalBytes = 0;
    const payload: Dm2ImportFileInput[] = [];

    for (const file of uploaded) {
      if (file.size > DM2_IMPORT_MAX_FILE_BYTES) {
        return jsonError(`${file.name} exceeds the per-file size limit.`);
      }
      totalBytes += file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      payload.push({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64: buffer.toString("base64"),
      });
    }

    if (totalBytes > DM2_IMPORT_MAX_TOTAL_BYTES) {
      return jsonError("Total upload size exceeds the session limit.");
    }

    const result = await processDm2ImportFiles(payload);
    const status = result.error && !result.session ? 400 : 200;
    return Response.json(result, { status });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to process uploaded files.",
      500
    );
  }
}
