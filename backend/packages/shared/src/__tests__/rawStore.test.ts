import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalRawStore } from "../rawStore.js";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("LocalRawStore", () => {
  let testDir: string;
  let store: LocalRawStore;

  beforeEach(async () => {
    testDir = join(tmpdir(), `rawstore-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(testDir, { recursive: true });
    store = new LocalRawStore(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should put and get string content with correct sha256 hash", async () => {
    const content = "<html><body>Draw Result</body></html>";
    const res = await store.put("2026/11/BT-80.html", content);

    expect(res.key).toBe("2026/11/BT-80.html");
    expect(res.contentHash).toBe("847b79e9cb88709621d0b982b1ced13dc7f16f54df3bd9013cb659eab5d3ec37");

    const retrieved = await store.get("2026/11/BT-80.html");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.toString("utf-8")).toBe(content);
  });

  it("should put and get binary Buffer content", async () => {
    const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    const res = await store.put("pdfs/test.pdf", buffer);

    expect(res.key).toBe("pdfs/test.pdf");
    expect(res.contentHash).toBeDefined();
    expect(await store.has("pdfs/test.pdf")).toBe(true);
    const read = await store.get("pdfs/test.pdf");
    expect(read).toEqual(buffer);
  });

  it("should return null and false for non-existent key", async () => {
    expect(await store.has("missing.html")).toBe(false);
    expect(await store.get("missing.html")).toBeNull();
  });
});
