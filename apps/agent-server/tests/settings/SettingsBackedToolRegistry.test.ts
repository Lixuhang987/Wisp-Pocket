import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileWorkspaceRegistry } from "@handagent/core/adapters/filesystem/FileWorkspaceRegistry.ts";
import { SettingsBackedToolRegistry } from "../../src/settings/SettingsBackedToolRegistry.ts";

describe("SettingsBackedToolRegistry", () => {
  it("refreshes the existing registry when tool settings stamp changes", async () => {
    const workspaceRegistry = await makeWorkspaceRegistry();
    let stamp = "v1";
    let denylist: string[] = [];
    const manager = new SettingsBackedToolRegistry(
      { workspaceRegistry },
      {
        readSettingsStamp: () => stamp,
        loadToolSettings: () => ({ allowlist: null, denylist }),
        log: () => {},
      },
    );

    await manager.refresh();
    expect(manager.registry.get("file.read")).toBeDefined();

    denylist = ["file.read"];
    stamp = "v2";
    await manager.refresh();

    expect(manager.registry.get("file.read")).toBeUndefined();
    expect(manager.registry.list().map((tool) => tool.name)).not.toContain("file.read");
  });

  it("skips reload when settings stamp is unchanged", async () => {
    let loadCount = 0;
    const manager = new SettingsBackedToolRegistry(
      {},
      {
        readSettingsStamp: () => "v1",
        loadToolSettings: () => {
          loadCount += 1;
          return { allowlist: null, denylist: [] };
        },
        log: () => {},
      },
    );

    await manager.refresh();
    await manager.refresh();

    expect(loadCount).toBe(1);
  });

  it("does not register legacy external tools", async () => {
    const legacyToolName = "external" + ".echo";
    const manager = new SettingsBackedToolRegistry(
      {},
      {
        readSettingsStamp: () => "v1",
        loadToolSettings: () => ({ allowlist: null, denylist: [] }),
        log: () => {},
      },
    );

    await manager.refresh();

    expect(manager.registry.list().map((tool) => tool.name)).not.toContain(
      legacyToolName,
    );
  });
});

async function makeWorkspaceRegistry() {
  const dir = await mkdtemp(join(tmpdir(), "settings-backed-tools-"));
  return new FileWorkspaceRegistry({
    filePath: join(dir, "workspaces.json"),
    defaultRootPath: join(dir, "ws"),
  });
}
