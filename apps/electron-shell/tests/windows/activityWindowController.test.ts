import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserWindowConstructorOptions, Rectangle } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityWindowController } from "../../src/main/windows/activityWindowController.js";
import { PetPositionStore } from "../../src/main/windows/petPositionStore.js";

const cleanup: Array<() => void> = [];
afterEach(() => { for (const dispose of cleanup.splice(0)) dispose(); });

describe("ActivityWindowController lifecycle boundaries", () => {
  it("passes the initial host theme and configured Thread endpoint to preload", async () => {
    const { controller, window } = createHarness({
      initialTheme: { preference: "system", resolved: "dark" },
      threadWebSocketURL: "ws://127.0.0.1:5321/api/thread",
    });
    await controller.show();

    expect(window.options.webPreferences?.additionalArguments).toContain(
      `--handagent-theme=${encodeURIComponent(JSON.stringify({ preference: "system", resolved: "dark" }))}`,
    );
    expect(window.options.webPreferences?.additionalArguments).toContain(
      `--handagent-pet-thread-websocket-url=${encodeURIComponent("ws://127.0.0.1:5321/api/thread")}`,
    );
    expect(window.loadedFile).toBe("/dist/activity-window/index.html");
  });

  it("broadcasts an in-flight theme change after loading, then sends later changes live", async () => {
    const loaded = createDeferred<void>();
    const { controller, window } = createHarness({ loadFilePromise: loaded.promise });
    const shown = controller.show();
    await controller.updateTheme({ preference: "dark", resolved: "dark" });
    expect(window.webContents.send).not.toHaveBeenCalled();
    loaded.resolve();
    await shown;
    await controller.updateTheme({ preference: "light", resolved: "light" });

    expect(window.webContents.send).toHaveBeenNthCalledWith(1, "handagent:theme-changed", { preference: "dark", resolved: "dark" });
    expect(window.webContents.send).toHaveBeenNthCalledWith(2, "handagent:theme-changed", { preference: "light", resolved: "light" });
  });

  it("shares loading across show requests and reports a window closed during loading", async () => {
    const loaded = createDeferred<void>();
    const { controller, window } = createHarness({ loadFilePromise: loaded.promise });
    const first = controller.show();
    const second = controller.show();
    const settled = Promise.allSettled([first, second]);
    window.destroy();
    loaded.resolve();

    expect(window.loadFileCount).toBe(1);
    expect(await settled).toEqual([
      { status: "rejected", reason: expect.objectContaining({ message: "pet window closed before it was shown" }) },
      { status: "rejected", reason: expect.objectContaining({ message: "pet window closed before it was shown" }) },
    ]);
  });

  it("reports a renderer crash through the existing shell callback", async () => {
    const onRendererCrashed = vi.fn();
    const { controller, window } = createHarness({ onRendererCrashed });
    await controller.show();
    window.webContents.emit("render-process-gone", {}, { reason: "clean-exit" });
    window.webContents.emit("render-process-gone", {}, { reason: "crashed" });
    expect(onRendererCrashed).toHaveBeenCalledExactlyOnceWith("crashed");
  });
});

function createHarness(options: {
  initialTheme?: { preference: "light" | "dark" | "system"; resolved: "light" | "dark" };
  threadWebSocketURL?: string;
  loadFilePromise?: Promise<void>;
  onRendererCrashed?: (reason: string) => void;
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "handagent-pet-controller-"));
  const window = new FakeBrowserWindow(options.loadFilePromise);
  const workArea = { x: 0, y: 0, width: 1440, height: 900 };
  const controller = new ActivityWindowController({
    activityWindowHTMLPath: "/dist/activity-window/index.html",
    preloadPath: "/dist/preload/activityWindowPreload.cjs",
    positionStore: new PetPositionStore(join(directory, "pet-position.json")),
    initialTheme: options.initialTheme,
    threadWebSocketURL: options.threadWebSocketURL,
    onRendererCrashed: options.onRendererCrashed,
    createWindow: (windowOptions) => { window.options = windowOptions; return window; },
    screenProvider: {
      getPrimaryWorkArea: () => workArea,
      getWorkAreaForPoint: () => workArea,
      getCursorScreenPoint: () => ({ x: 0, y: 0 }),
      subscribeWorkAreaChanges: () => () => {},
    },
  });
  cleanup.push(() => { window.destroy(); rmSync(directory, { recursive: true, force: true }); });
  return { window, controller };
}

class FakeBrowserWindow extends EventEmitter {
  webContents = Object.assign(new EventEmitter(), { send: vi.fn() });
  options: BrowserWindowConstructorOptions = {};
  bounds: Rectangle = { x: 0, y: 0, width: 1, height: 1 };
  loadedFile: string | null = null;
  loadFileCount = 0;
  constructor(private readonly loadFilePromise: Promise<void> = Promise.resolve()) { super(); }
  setBounds(bounds: Rectangle): void { this.bounds = bounds; }
  getBounds(): Rectangle { return this.bounds; }
  setIgnoreMouseEvents(): void {}
  loadFile(filePath: string): Promise<void> {
    this.loadedFile = filePath;
    this.loadFileCount += 1;
    return this.loadFilePromise;
  }
  showInactive(): void {}
  destroy(): void { this.emit("closed"); }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => { resolve = innerResolve; });
  return { promise, resolve };
}
