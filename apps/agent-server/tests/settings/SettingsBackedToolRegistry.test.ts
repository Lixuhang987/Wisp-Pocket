import { describe, expect, it } from "vitest";
import { SettingsBackedToolRegistry } from "../../src/settings/SettingsBackedToolRegistry.ts";

describe("SettingsBackedToolRegistry", () => {
  it("refreshes the existing registry when tool settings stamp changes", async () => {
    let stamp = "v1";
    let denylist: string[] = [];
    const manager = new SettingsBackedToolRegistry(
      {
        readSettingsStamp: () => stamp,
        loadToolSettings: () => ({ allowlist: null, denylist }),
        log: () => {},
      },
    );

    await manager.refresh();
    expect(manager.registry.get("file.write")).toBeDefined();

    denylist = ["file.write"];
    stamp = "v2";
    await manager.refresh();

    expect(manager.registry.get("file.write")).toBeUndefined();
    expect(manager.registry.list().map((tool) => tool.name)).not.toContain("file.write");
  });

  it("skips reload when settings stamp is unchanged", async () => {
    let loadCount = 0;
    const manager = new SettingsBackedToolRegistry(
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
