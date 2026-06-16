import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { ActivityWindowController } from "../../src/main/windows/activityWindowController.js";

describe("ActivityWindowController", () => {
  it("creates a frameless transparent activity window and shows it inactive", async () => {
    const window = new FakeBrowserWindow();
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow: (options) => {
        expect(options).toMatchObject({
          width: 272,
          height: 76,
          show: false,
          frame: false,
          transparent: true,
          alwaysOnTop: true,
          skipTaskbar: true,
          focusable: true,
          acceptFirstMouse: true,
          resizable: false,
          webPreferences: {
            preload: "/dist/preload/activityWindowPreload.cjs",
            contextIsolation: true,
            nodeIntegration: false,
          },
        });
        return window;
      },
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
    });

    await controller.show();

    expect(window.bounds).toEqual({ x: 1144, y: 800, width: 272, height: 76 });
    expect(window.loadedFile).toBe("/dist/activity-window/index.html");
    expect(window.showInactiveCount).toBe(1);
  });

  it("reuses a live activity window", async () => {
    const window = new FakeBrowserWindow();
    const createWindow = vi.fn(() => window);
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow,
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 20, y: 10, width: 1440, height: 900 }),
      },
    });

    await controller.show();
    await controller.show();

    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(window.loadFileCount).toBe(1);
    expect(window.showInactiveCount).toBe(2);
    expect(window.bounds).toEqual({ x: 1164, y: 810, width: 272, height: 76 });
  });

  it("broadcasts an in-flight theme change after the existing activity window loads", async () => {
    const window = new FakeBrowserWindow();
    const loaded = createDeferred<void>();
    window.loadFile = (filePath: string): Promise<void> => {
      window.loadedFile = filePath;
      window.loadFileCount += 1;
      return loaded.promise;
    };
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow: () => window,
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
    });

    const shown = controller.show();
    await controller.updateTheme({ preference: "dark", resolved: "dark" });
    expect(window.webContents.send).not.toHaveBeenCalled();

    loaded.resolve();
    await shown;

    expect(window.webContents.send).toHaveBeenCalledWith(
      "handagent:theme-changed",
      { preference: "dark", resolved: "dark" },
    );
  });

  it("resets the live window after close", async () => {
    const firstWindow = new FakeBrowserWindow();
    const secondWindow = new FakeBrowserWindow();
    const windows = [firstWindow, secondWindow];
    const createWindow = vi.fn(() => {
      const window = windows.shift();
      if (!window) {
        throw new Error("unexpected createWindow");
      }
      return window;
    });
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow,
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
    });

    await controller.show();
    firstWindow.emit("closed");
    await controller.show();

    expect(createWindow).toHaveBeenCalledTimes(2);
  });

  it("emits renderer crashed callback for non-clean render exits", async () => {
    const window = new FakeBrowserWindow();
    const onRendererCrashed = vi.fn();
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow: () => window,
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
      onRendererCrashed,
    });

    await controller.show();
    window.webContents.emit("render-process-gone", {}, { reason: "clean-exit" });
    window.webContents.emit("render-process-gone", {}, { reason: "crashed" });

    expect(onRendererCrashed).toHaveBeenCalledTimes(1);
    expect(onRendererCrashed).toHaveBeenCalledWith("crashed");
  });

  it("emits native focus as an activity click fallback", async () => {
    const window = new FakeBrowserWindow();
    const onNativeFocus = vi.fn();
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow: () => window,
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
      onNativeFocus,
    });

    await controller.show();
    expect(onNativeFocus).not.toHaveBeenCalled();

    window.emit("focus");

    expect(onNativeFocus).toHaveBeenCalledTimes(1);
  });

  it("emits native left mouse down as a focused activity click fallback", async () => {
    const window = new FakeBrowserWindow();
    const onNativeMouseDown = vi.fn();
    const preventDefault = vi.fn();
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow: () => window,
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
      onNativeMouseDown,
    });

    await controller.show();
    expect(onNativeMouseDown).not.toHaveBeenCalled();

    window.webContents.emit(
      "before-mouse-event",
      { preventDefault },
      { type: "mouseDown", button: "left", x: 128, y: 32 },
    );

    expect(onNativeMouseDown).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("treats native mouse down without button as an activity click fallback", async () => {
    const window = new FakeBrowserWindow();
    const onNativeMouseDown = vi.fn();
    const preventDefault = vi.fn();
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow: () => window,
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
      onNativeMouseDown,
    });

    await controller.show();
    expect(onNativeMouseDown).not.toHaveBeenCalled();

    window.webContents.emit(
      "before-mouse-event",
      { preventDefault },
      { type: "mouseDown", x: 128, y: 32 },
    );

    expect(onNativeMouseDown).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("ignores non-click native mouse events", async () => {
    const window = new FakeBrowserWindow();
    const onNativeMouseDown = vi.fn();
    const preventDefault = vi.fn();
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow: () => window,
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
      onNativeMouseDown,
    });

    await controller.show();
    window.webContents.emit(
      "before-mouse-event",
      { preventDefault },
      { type: "mouseMove", button: "left", x: 128, y: 32 },
    );
    window.webContents.emit(
      "before-mouse-event",
      { preventDefault },
      { type: "mouseDown", button: "right", x: 128, y: 32 },
    );

    expect(onNativeMouseDown).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("releases stale native window state for the next activity click without a visible gap", async () => {
    const firstWindow = new FakeBrowserWindow();
    const deferredLoad = createDeferred<void>();
    const secondWindow = new FakeBrowserWindow({ loadFilePromise: deferredLoad.promise });
    const windows = [firstWindow, secondWindow];
    const createWindow = vi.fn(() => {
      const window = windows.shift();
      if (!window) {
        throw new Error("unexpected createWindow");
      }
      return window;
    });
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow,
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
    });

    await controller.show();
    controller.releaseNativeFocusForNextClick();

    expect(createWindow).toHaveBeenCalledTimes(2);
    expect(firstWindow.destroyCount).toBe(0);
    expect(secondWindow.showInactiveCount).toBe(0);

    deferredLoad.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(firstWindow.destroyCount).toBe(1);
    expect(firstWindow.showInactiveCount).toBe(1);
    expect(secondWindow.loadedFile).toBe("/dist/activity-window/index.html");
    expect(secondWindow.showInactiveCount).toBe(1);
    expect(secondWindow.bounds).toEqual({ x: 1144, y: 800, width: 272, height: 76 });
  });

  it("replays the latest theme to the replacement activity window after it loads", async () => {
    const firstWindow = new FakeBrowserWindow();
    const deferredLoad = createDeferred<void>();
    const secondWindow = new FakeBrowserWindow({ loadFilePromise: deferredLoad.promise });
    const windows = [firstWindow, secondWindow];
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow: () => {
        const window = windows.shift();
        if (!window) {
          throw new Error("unexpected createWindow");
        }
        return window;
      },
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
    });

    await controller.show();
    controller.releaseNativeFocusForNextClick();
    await controller.updateTheme({ preference: "dark", resolved: "dark" });

    expect(secondWindow.webContents.send).not.toHaveBeenCalled();

    deferredLoad.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(secondWindow.webContents.send).toHaveBeenCalledWith(
      "handagent:theme-changed",
      { preference: "dark", resolved: "dark" },
    );
  });

  it("ignores native focus release before the activity window exists", () => {
    const controller = new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html",
      preloadPath: "/dist/preload/activityWindowPreload.cjs",
      createWindow: () => {
        throw new Error("window should not be created");
      },
      screenProvider: {
        getPrimaryWorkArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
      },
    });

    controller.releaseNativeFocusForNextClick();
  });
});

class FakeBrowserWindow extends EventEmitter {
  webContents = Object.assign(new EventEmitter(), {
    send: vi.fn(),
  });
  bounds: { x: number; y: number; width: number; height: number } | null = null;
  loadedFile: string | null = null;
  loadFileCount = 0;
  showInactiveCount = 0;
  destroyCount = 0;
  private readonly loadFilePromise: Promise<void> | null;

  constructor(options: { loadFilePromise?: Promise<void> } = {}) {
    super();
    this.loadFilePromise = options.loadFilePromise ?? null;
  }

  setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.bounds = bounds;
  }

  loadFile(filePath: string): Promise<void> {
    this.loadedFile = filePath;
    this.loadFileCount += 1;
    return this.loadFilePromise ?? Promise.resolve();
  }

  showInactive(): void {
    this.showInactiveCount += 1;
  }

  destroy(): void {
    this.destroyCount += 1;
    this.emit("closed");
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}
