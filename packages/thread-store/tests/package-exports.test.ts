import { describe, expect, it } from "vitest";

describe("@handagent/thread-store exports", () => {
  it("exposes the concrete ThreadStore and CurrentThread classes", async () => {
    const mod = await import("../src/index.ts");

    expect(mod.ThreadStore).toBeTypeOf("function");
    expect(mod.CurrentThread).toBeTypeOf("function");
  });
});
