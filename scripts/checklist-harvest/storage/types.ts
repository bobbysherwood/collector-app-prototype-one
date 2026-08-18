export interface StorageAdapter {
  read(path: string): Promise<Buffer>;
  readText(path: string): Promise<string>;
  write(path: string, data: Buffer | string): Promise<void>;
  exists(path: string): Promise<boolean>;
  copy(src: string, dest: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  ensureDir(path: string): Promise<void>;
}

export type StorageKind = "local" | "supabase";
