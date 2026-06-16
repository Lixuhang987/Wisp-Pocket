import { describe, expect, it } from "vitest";
import { readInitialHostTheme } from "../../src/main/initialHostTheme.js";

describe("readInitialHostTheme", () => {
  it("falls back when no startup theme is provided", () => {
    expect(readInitialHostTheme(undefined)).toEqual({ preference: "system", resolved: "light" });
  });

  it("falls back when startup theme JSON is malformed", () => {
    expect(readInitialHostTheme("{bad json")).toEqual({ preference: "system", resolved: "light" });
  });

  it("falls back when startup theme fields are invalid", () => {
    expect(readInitialHostTheme(JSON.stringify({ preference: "system", resolved: "system" }))).toEqual({
      preference: "system",
      resolved: "light",
    });
  });

  it("accepts an explicit dark startup theme", () => {
    expect(readInitialHostTheme(JSON.stringify({ preference: "dark", resolved: "dark" }))).toEqual({
      preference: "dark",
      resolved: "dark",
    });
  });

  it("preserves system preference with a dark resolved theme", () => {
    expect(readInitialHostTheme(JSON.stringify({ preference: "system", resolved: "dark" }))).toEqual({
      preference: "system",
      resolved: "dark",
    });
  });
});
