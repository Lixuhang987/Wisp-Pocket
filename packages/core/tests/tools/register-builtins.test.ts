import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerBuiltinTools } from "../../src/tools/registerBuiltins.ts";
import { FileWorkspaceRegistry } from "../../src/adapters/filesystem/FileWorkspaceRegistry.ts";
import { ToolRegistry } from "../../src/tools/ToolRegistry.ts";

async function makeRegistry() {
  const dir = await mkdtemp(join(tmpdir(), "register-builtins-"));
  return new FileWorkspaceRegistry({
    filePath: join(dir, "workspaces.json"),
    defaultRootPath: join(dir, "ws"),
  });
}

describe("registerBuiltinTools", () => {
  it("registers all builtin tools when workspace registry, ask resolver, and default settings are provided", async () => {
    const workspaceRegistry = await makeRegistry();

    const { registry, registered, disabled } = registerBuiltinTools({
      workspaceRegistry,
      workspaceAskResolver: async () => ({ cancelled: true }),
    });

    expect(registered.sort()).toEqual(
      [
        "file.read",
        "file.write",
        "workspace.askUser",
        "workspace.list",
      ].sort(),
    );
    expect(disabled).toEqual([]);
    expect(registry.list().map((t) => t.name).sort()).toEqual(registered.sort());
  });

  it("disables file tools when workspace registry is missing", async () => {
    const { registered, disabled } = registerBuiltinTools({});

    expect(registered).not.toContain("file.read");
    expect(registered).not.toContain("file.write");
    expect(registered).not.toContain("workspace.askUser");
    expect(disabled.find((d) => d.name === "file.read")?.reason).toContain(
      "workspace registry",
    );
    expect(disabled.find((d) => d.name === "workspace.askUser")?.reason).toContain(
      "workspace registry",
    );
  });

  it("disables workspace.askUser when ask resolver is missing", async () => {
    const workspaceRegistry = await makeRegistry();
    const { registered, disabled } = registerBuiltinTools({ workspaceRegistry });

    expect(registered).not.toContain("workspace.askUser");
    expect(disabled.find((d) => d.name === "workspace.askUser")?.reason).toContain(
      "workspace ask resolver",
    );
  });

  it("respects denylist", async () => {
    const workspaceRegistry = await makeRegistry();

    const { registered, disabled } = registerBuiltinTools({
      workspaceRegistry,
      settings: { allowlist: null, denylist: ["file.read"] },
    });

    expect(registered).not.toContain("file.read");
    expect(disabled.find((d) => d.name === "file.read")?.reason).toBe("denylist");
  });

  it("respects allowlist (only listed tools enabled)", async () => {
    const workspaceRegistry = await makeRegistry();

    const { registered, disabled } = registerBuiltinTools({
      workspaceRegistry,
      workspaceAskResolver: async () => ({ cancelled: true }),
      settings: { allowlist: ["file.read"], denylist: [] },
    });

    expect(registered.sort()).toEqual(["file.read"]);
    expect(disabled.some((d) => d.name === "file.write")).toBe(true);
  });

  it("re-registers tools into an existing registry when settings change", async () => {
    const workspaceRegistry = await makeRegistry();
    const registry = new ToolRegistry();

    registerBuiltinTools({
      registry,
      workspaceRegistry,
      settings: { allowlist: null, denylist: [] },
    });
    expect(registry.get("file.read")).toBeDefined();

    registerBuiltinTools({
      registry,
      workspaceRegistry,
      settings: { allowlist: null, denylist: ["file.read"] },
    });

    expect(registry.get("file.read")).toBeUndefined();
    expect(registry.list().map((tool) => tool.name)).not.toContain("file.read");
  });
});
