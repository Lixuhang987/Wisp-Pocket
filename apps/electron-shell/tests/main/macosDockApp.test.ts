import { describe, expect, it, vi } from "vitest";
import { configureMacOSDockApp } from "../../src/main/macosDockApp.js";

describe("configureMacOSDockApp", () => {
  it("uses regular activation policy and shows the Dock icon on macOS", () => {
    const app = {
      setActivationPolicy: vi.fn(),
      dock: { show: vi.fn() },
    };

    configureMacOSDockApp(app, "darwin");

    expect(app.setActivationPolicy).toHaveBeenCalledWith("regular");
    expect(app.dock.show).toHaveBeenCalledTimes(1);
  });

  it("does not touch activation policy on non-macOS platforms", () => {
    const app = {
      setActivationPolicy: vi.fn(),
      dock: { show: vi.fn() },
    };

    configureMacOSDockApp(app, "linux");

    expect(app.setActivationPolicy).not.toHaveBeenCalled();
    expect(app.dock.show).not.toHaveBeenCalled();
  });
});
