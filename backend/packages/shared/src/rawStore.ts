import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";

/**
 * RawStore defines storage interface for fetched raw HTML / PDF payloads.
 * Follows design doc 3.1 & 5.2.
 */
export interface RawStore {
  /**
   * Put content into store. Returns the contentHash (SHA-256 hex).
   */
  put(key: string, content: Buffer | string): Promise<{ key: string; contentHash: string }>;

  /**
   * Retrieve content by key.
   */
  get(key: string): Promise<Buffer | null>;

  /**
   * Check whether key exists in store.
   */
  has(key: string): Promise<boolean>;
}

/**
 * LocalRawStore writes raw payloads to local filesystem (e.g. mounted docker volume).
 */
export class LocalRawStore implements RawStore {
  constructor(private readonly baseDir: string) {}

  private getFilePath(key: string): string {
    // Sanitize key to prevent path traversal
    const safeKey = key.replace(/[^a-zA-Z0-9_\-./]/g, "_");
    return join(this.baseDir, safeKey);
  }

  async put(key: string, content: Buffer | string): Promise<{ key: string; contentHash: string }> {
    const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
    const contentHash = createHash("sha256").update(buffer).digest("hex");
    const fullPath = this.getFilePath(key);

    const dir = fullPath.substring(0, fullPath.lastIndexOf(/[\/\\]/.exec(fullPath)?.[0] || "/"));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return { key, contentHash };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const fullPath = this.getFilePath(key);
      return await fs.readFile(fullPath);
    } catch {
      return null;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const fullPath = this.getFilePath(key);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
