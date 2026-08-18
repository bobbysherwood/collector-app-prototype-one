import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { StorageAdapter } from "./types";

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private root: string) {}

  private resolve(path: string): string {
    return join(this.root, path.replace(/\\/g, "/"));
  }

  async ensureDir(path: string): Promise<void> {
    await mkdir(this.resolve(path), { recursive: true });
  }

  async read(path: string): Promise<Buffer> {
    return readFile(this.resolve(path));
  }

  async readText(path: string): Promise<string> {
    return readFile(this.resolve(path), "utf8");
  }

  async write(path: string, data: Buffer | string): Promise<void> {
    const full = this.resolve(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(this.resolve(path));
      return true;
    } catch {
      return false;
    }
  }

  async copy(src: string, dest: string): Promise<void> {
    const destFull = this.resolve(dest);
    await mkdir(dirname(destFull), { recursive: true });
    await copyFile(this.resolve(src), destFull);
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.resolve(prefix);
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      return entries.map((e) => `${prefix.replace(/\\/g, "/")}/${e.name}`);
    } catch {
      return [];
    }
  }
}

export function createLocalStorage(root?: string): LocalStorageAdapter {
  const resolved =
    root ??
    process.env.CHECKLIST_HARVEST_ROOT ??
    join(process.cwd(), "data", "checklist-harvest");
  return new LocalStorageAdapter(resolved);
}
