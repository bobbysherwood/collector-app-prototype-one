import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StorageAdapter } from "./types";

const BUCKET = "checklist-harvest";

export class SupabaseStorageAdapter implements StorageAdapter {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async ensureDir(_path: string): Promise<void> {
    // No-op for object storage
  }

  async read(path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(BUCKET).download(path);
    if (error || !data) throw new Error(error?.message ?? `Failed to read ${path}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async readText(path: string): Promise<string> {
    const buf = await this.read(path);
    return buf.toString("utf8");
  }

  async write(path: string, data: Buffer | string): Promise<void> {
    const body = typeof data === "string" ? Buffer.from(data) : data;
    const { error } = await this.client.storage.from(BUCKET).upload(path, body, {
      upsert: true,
      contentType: path.endsWith(".json") ? "application/json" : "text/csv",
    });
    if (error) throw new Error(error.message);
  }

  async exists(path: string): Promise<boolean> {
    const parts = path.split("/");
    const fileName = parts.pop()!;
    const prefix = parts.join("/");
    const { data, error } = await this.client.storage.from(BUCKET).list(prefix, {
      search: fileName,
    });
    if (error) return false;
    return (data ?? []).some((f) => f.name === fileName);
  }

  async copy(src: string, dest: string): Promise<void> {
    const bytes = await this.read(src);
    await this.write(dest, bytes);
  }

  async list(prefix: string): Promise<string[]> {
    const { data, error } = await this.client.storage.from(BUCKET).list(prefix);
    if (error || !data) return [];
    return data.map((f) => `${prefix}/${f.name}`);
  }
}

export function createSupabaseStorage(): SupabaseStorageAdapter {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for supabase storage");
  }
  return new SupabaseStorageAdapter(url, key);
}
