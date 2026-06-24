import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultToolSettings,
  filterToolNames,
  loadToolSettings,
  toolSettingsFilePath,
} from "../../src/config/ToolSettings.ts";

describe("ToolSettings", () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "tool-settings-"));
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
  });

  it("returns defaults when settings file is missing", () => {
    expect(loadToolSettings(homeDir)).toEqual(defaultToolSettings);
  });

  it("returns defaults on invalid JSON", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(homeDir, ".spotAgent"), { recursive: true });
    await writeFile(toolSettingsFilePath(homeDir), "not json");
    expect(loadToolSettings(homeDir)).toEqual(defaultToolSettings);
  });

  it("parses allowlist and denylist", async () => {
    const path = toolSettingsFilePath(homeDir);
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(homeDir, ".spotAgent"), { recursive: true });
    await writeFile(
      path,
      JSON.stringify({
        tools: {
          allowlist: ["file.read", "workspace.list"],
          denylist: ["file.write"],
        },
      }),
    );

    expect(loadToolSettings(homeDir)).toEqual({
      allowlist: ["file.read", "workspace.list"],
      denylist: ["file.write"],
    });
  });

  it("filterToolNames applies denylist before allowlist", () => {
    const result = filterToolNames(
      ["file.read", "file.write", "workspace.list"],
      { allowlist: ["file.read", "workspace.list"], denylist: ["workspace.list"] },
    );

    expect(result.enabled).toEqual(["file.read"]);
    expect(result.disabled.map((d) => d.name).sort()).toEqual([
      "file.write",
      "workspace.list",
    ]);
  });
});
