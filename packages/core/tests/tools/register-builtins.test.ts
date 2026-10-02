import { describe, expect, it } from "vitest";
import { registerBuiltinTools } from "../../src/tools/registerBuiltins.ts";
import { ToolRegistry } from "../../src/tools/ToolRegistry.ts";

describe("builtin写入工具设置", () => {
  it("注册file.write，执行时由Thread上下文提供固定目录", () => {
    const { registry, registered, disabled } = registerBuiltinTools({});
    expect(registered).toEqual(["file.write"]);
    expect(registry.get("file.write")).toBeDefined();
    expect(disabled).toEqual([]);
  });
  it("denylist和allowlist继续约束写入", () => {
    const denied = registerBuiltinTools({ settings: { allowlist: null, denylist: ["file.write"] } });
    expect(denied.registered).toEqual([]);
    expect(denied.disabled).toContainEqual({ name: "file.write", reason: "denylist" });
    expect(registerBuiltinTools({ settings: { allowlist: ["file.write"], denylist: [] } }).registered).toEqual(["file.write"]);
    expect(registerBuiltinTools({ settings: { allowlist: [], denylist: [] } }).registered).toEqual([]);
  });
  it("热加载在同一registry启用/禁用写入", () => {
    const registry = new ToolRegistry();
    registerBuiltinTools({ registry }); expect(registry.get("file.write")).toBeDefined();
    registerBuiltinTools({ registry, settings: { allowlist: null, denylist: ["file.write"] } });
    expect(registry.get("file.write")).toBeUndefined();
    registerBuiltinTools({ registry }); expect(registry.get("file.write")).toBeDefined();
  });
});
