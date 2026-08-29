import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Storage abstraction (03 WP-0F): S3+KMS in deployment; LocalFsAdapter is the
 * dev/test implementation. Keys are opaque — adapters must reject traversal.
 */
export interface StoragePort {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}

export class LocalFsAdapter implements StoragePort {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = resolve(rootDir);
  }

  private safePath(key: string): string {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + "/")) {
      throw new RangeError(`invalid storage key: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.safePath(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.safePath(key));
  }
}

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
