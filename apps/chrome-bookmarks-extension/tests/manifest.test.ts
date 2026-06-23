import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const developmentExtensionId = "iidkhdjaboimibeplbeanlklgakmfebb";
const testDirectory = dirname(fileURLToPath(import.meta.url));

describe("Chrome bookmarks extension manifest", () => {
  it("uses a fixed development key that derives the expected extension id", () => {
    const manifest = JSON.parse(readFileSync(resolve(testDirectory, "../manifest.json"), "utf8")) as {
      key?: string;
    };

    expect(manifest.key).toBeTypeOf("string");
    expect(extensionIdFromManifestKey(manifest.key ?? "")).toBe(developmentExtensionId);
  });
});

function extensionIdFromManifestKey(manifestKey: string): string {
  const digest = createHash("sha256").update(Buffer.from(manifestKey, "base64")).digest();
  let extensionId = "";
  for (const byte of digest.subarray(0, 16)) {
    extensionId += String.fromCharCode(97 + (byte >> 4));
    extensionId += String.fromCharCode(97 + (byte & 0x0f));
  }
  return extensionId;
}
