import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserWindowConstructorOptions, Point, Rectangle } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElectronShellRuntime } from "../../src/main/electronShellRuntime.js";
import { registerPetWindowIpc } from "../../src/main/petWindowIpc.js";
import { ActivityWindowController } from "../../src/main/windows/activityWindowController.js";
import { PetPositionStore } from "../../src/main/windows/petPositionStore.js";

const nodeRequire = createRequire(import.meta.url);
const preloadPath = nodeRequire.resolve("../../dist/preload/activityWindowPreload.cjs");
const temporaryDirectories: string[] = [];
const liveWindows: FakeBrowserWindow[] = [];

type PetBridge = {
  setLayout(mode: "pet" | "compact" | "expanded"): void;
  setInteractiveRegions(rectangles: Rectangle[]): void;
  beginMove(): void;
  move(): void;
  endMove(): void;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const window of liveWindows.splice(0)) window.destroy();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
  delete (globalThis as { window?: unknown }).window;
  delete nodeRequire.cache[preloadPath];
  vi.useRealTimers();
});

describe("桌宠原生窗口用例", () => {
  it("非激活显示后展开、接收点击滚动与外部 drop，并从透明空白恢复命中", async () => {
    const harness = await createHarness();
    const { window, bridge, screen } = harness;

    expect(window.options).toMatchObject({
      width: 192, height: 208, show: false, frame: false, transparent: true,
      alwaysOnTop: true, skipTaskbar: true, focusable: true,
      acceptFirstMouse: true, resizable: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    expect(window.bounds).toEqual({ x: 1224, y: 668, width: 192, height: 208 });
    expect(window.showInactiveCount).toBe(1);
    expect(window.focusedSurface).toBe("other-app");
    expect(harness.mainWorld.handAgentActivityWindowConfig).toEqual({
      threadWebSocketURL: "ws://127.0.0.1:4317/api/thread?acceptServerRequests=1",
    });
    expect(Object.keys(bridge).sort()).toEqual([
      "beginMove", "endMove", "move", "setInteractiveRegions", "setLayout",
    ]);

    bridge.setLayout("compact");
    expect(window.bounds).toEqual({ x: 1048, y: 506, width: 368, height: 370 });
    bridge.setLayout("expanded");
    expect(window.bounds).toEqual({ x: 1048, y: 236, width: 368, height: 640 });
    bridge.setInteractiveRegions([
      { x: 0, y: 0, width: 368, height: 412 },
      { x: 176, y: 432, width: 192, height: 208 },
    ]);

    screen.cursor = { x: 1098, y: 286 };
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("mouseDown")).toBe("renderer");
    expect(window.focusedSurface).toBe("pet");
    expect(window.deliverMouse("mouseWheel")).toBe("renderer");
    expect(window.deliverMouse("drop")).toBe("renderer");
    expect(window.rendererEvents).toEqual(["mouseDown", "mouseWheel", "drop"]);

    screen.cursor = { x: 1068, y: 736 };
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("mouseDown")).toBe("other-app");
    expect(window.lastIgnoreOptions).toEqual({ forward: true });

    // 外部应用拖入只改变系统光标；没有 renderer mousemove 也必须恢复 drop 命中。
    screen.cursor = { x: 1298, y: 736 };
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("drop")).toBe("renderer");
  });

  it("角色拖动保持捕获，记住位置，关闭 ThreadWindow 后继续使用同一桌宠，再次启动恢复", async () => {
    const harness = await createHarness();
    const { window, bridge, screen, positionPath } = harness;
    bridge.setLayout("expanded");
    bridge.setInteractiveRegions([{ x: 176, y: 432, width: 192, height: 208 }]);
    screen.cursor = { x: 1298, y: 736 };
    bridge.beginMove();
    screen.cursor = { x: 948, y: 636 };
    bridge.move();
    expect(window.bounds).toEqual({ x: 698, y: 136, width: 368, height: 640 });

    // pointer capture 期间即使光标离开已上报 DOM 矩形，也继续交给 renderer。
    screen.cursor = { x: 718, y: 186 };
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("mouseMove")).toBe("renderer");
    screen.cursor = { x: 948, y: 636 };
    bridge.endMove();
    expect(JSON.parse(readFileSync(positionPath, "utf8"))).toEqual({ right: 1066, bottom: 776 });

    window.rendererState = { currentThreadId: "thread-1", draft: "继续阅读" };
    harness.runtime.handleThreadWindowClosed({ wasPrepared: true, wasVisible: true });
    bridge.setLayout("pet");
    await harness.controller.show();
    expect(harness.controller.currentWebContents()).toBe(window.webContents);
    expect(window.rendererState).toEqual({ currentThreadId: "thread-1", draft: "继续阅读" });
    expect(window.loadFileCount).toBe(1);
    expect(window.bounds).toEqual({ x: 874, y: 568, width: 192, height: 208 });

    window.destroy();
    const restored = await createHarness({ positionPath });
    expect(restored.window.bounds).toEqual({ x: 874, y: 568, width: 192, height: 208 });
    expect(restored.window.focusedSurface).toBe("other-app");
  });

  it("恢复离屏位置、切换屏幕工作区和展开气泡时，完整窗口保持在可用屏幕内", async () => {
    const positionPath = createPositionPath();
    writeFileSync(positionPath, JSON.stringify({ right: 6200, bottom: 3500 }));
    const screen = new FakeScreen({ x: 0, y: 30, width: 1000, height: 670 });
    const { bridge, window } = await createHarness({ positionPath, screen });
    expect(window.bounds).toEqual({ x: 808, y: 492, width: 192, height: 208 });

    bridge.setLayout("expanded");
    expect(window.bounds).toEqual({ x: 632, y: 60, width: 368, height: 640 });
    screen.workArea = { x: -900, y: 24, width: 900, height: 540 };
    screen.emit("work-area-changed");
    expect(window.bounds).toEqual({ x: -368, y: 24, width: 368, height: 540 });
    bridge.setLayout("pet");
    expect(window.bounds).toEqual({ x: -192, y: 356, width: 192, height: 208 });
    expect(JSON.parse(readFileSync(positionPath, "utf8"))).toEqual({ right: 0, bottom: 564 });
  });

  it("靠近上边缘悬停时缩短历史窗口，主气泡与角色的锚点保持原位", async () => {
    const positionPath = createPositionPath();
    writeFileSync(positionPath, JSON.stringify({ right: 900, bottom: 440 }));
    const screen = new FakeScreen({ x: 0, y: 30, width: 1000, height: 670 });
    const { bridge, window } = await createHarness({ positionPath, screen });
    bridge.setLayout("compact");
    const compactBounds = { ...window.bounds };
    const savedPosition = readFileSync(positionPath, "utf8");
    bridge.setLayout("expanded");
    expect(window.bounds.x + window.bounds.width).toBe(compactBounds.x + compactBounds.width);
    expect(window.bounds.y + window.bounds.height).toBe(compactBounds.y + compactBounds.height);
    expect(window.bounds.y).toBe(screen.workArea.y);
    expect(readFileSync(positionPath, "utf8")).toBe(savedPosition);
    bridge.setLayout("compact");
    expect(window.bounds).toEqual(compactBounds);
  });

  it("配置损坏时仍可显示，并只允许当前桌宠的有效 IPC 改变窗口", async () => {
    const positionPath = createPositionPath();
    writeFileSync(positionPath, "{unfinished");
    const { bridge, window, ipcMain, screen } = await createHarness({ positionPath });
    bridge.setLayout("compact");
    const expectedBounds = { ...window.bounds };
    ipcMain.emit("pet-window:set-layout", { sender: {} }, "expanded");
    ipcMain.emit("pet-window:set-layout", { sender: window.webContents }, { width: 9000 });
    ipcMain.emit("pet-window:begin-move", { sender: window.webContents }, { x: -3000 });
    screen.cursor = { x: -3000, y: -3000 };
    bridge.move();
    expect(window.bounds).toEqual(expectedBounds);

    bridge.setInteractiveRegions([{ x: 0, y: 0, width: 368, height: 100 }]);
    screen.cursor = { x: window.bounds.x + 40, y: window.bounds.y + 40 };
    ipcMain.emit("pet-window:set-interactive-regions", { sender: window.webContents }, [
      { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 100 },
    ]);
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("mouseDown")).toBe("renderer");
    bridge.setLayout("pet");
    expect(window.bounds).toEqual({ x: 1224, y: 668, width: 192, height: 208 });
  });
});

async function createHarness(options: { positionPath?: string; screen?: FakeScreen } = {}) {
  const positionPath = options.positionPath ?? createPositionPath();
  const screen = options.screen ?? new FakeScreen();
  let window!: FakeBrowserWindow;
  const controller = new ActivityWindowController({
    activityWindowHTMLPath: "/dist/activity-window/index.html",
    preloadPath,
    positionStore: new PetPositionStore(positionPath),
    screenProvider: screen,
    createWindow: (windowOptions) => {
      window = new FakeBrowserWindow(windowOptions);
      liveWindows.push(window);
      return window;
    },
  });
  const ipcMain = new EventEmitter();
  registerPetWindowIpc(ipcMain, controller);
  const runtime = new ElectronShellRuntime({
    activityWindow: controller,
    prewarmer: {
      prepare: async () => {}, openInitialPrompt: async () => {}, openHistory: async () => {},
      focus: () => true, updateTheme: async () => {},
    },
    send: () => {}, now: () => "2026-09-13T00:00:00.000Z", stopSupervisor: () => {}, quit: () => {},
  });
  await runtime.handleCommand({ channel: "electron_shell", type: "activity_window.show", commandId: "show-pet" });
  const mainWorld: Record<string, unknown> = {};
  (globalThis as { window?: unknown }).window = mainWorld;
  const previousArgv = process.argv;
  process.argv = [previousArgv[0]!, ...window.options.webPreferences?.additionalArguments ?? []];
  try {
    delete nodeRequire.cache[preloadPath];
    withElectronMock({
      contextBridge: {
        executeInMainWorld: ({ func, args }: { func: (...args: unknown[]) => void; args: unknown[] }) => func(...args),
        exposeInMainWorld: (name: string, value: unknown) => { mainWorld[name] = value; },
      },
      ipcRenderer: {
        on: () => {},
        send: (channel: string, ...args: unknown[]) => ipcMain.emit(channel, { sender: window.webContents }, ...args),
      },
    }, () => nodeRequire(preloadPath));
  } finally {
    process.argv = previousArgv;
  }
  return { controller, runtime, window, screen, positionPath, ipcMain, mainWorld, bridge: mainWorld.handAgentPet as PetBridge };
}

function createPositionPath(): string {
  const directory = mkdtempSync(join(tmpdir(), "handagent-pet-window-"));
  temporaryDirectories.push(directory);
  return join(directory, "pet-position.json");
}

class FakeScreen extends EventEmitter {
  cursor: Point = { x: 0, y: 0 };
  constructor(public workArea: Rectangle = { x: 0, y: 0, width: 1440, height: 900 }) { super(); }
  getPrimaryWorkArea(): Rectangle { return this.workArea; }
  getWorkAreaForPoint(): Rectangle { return this.workArea; }
  getCursorScreenPoint(): Point { return this.cursor; }
  subscribeWorkAreaChanges(listener: () => void): () => void {
    this.on("work-area-changed", listener);
    return () => { this.off("work-area-changed", listener); };
  }
}

class FakeBrowserWindow extends EventEmitter {
  webContents = Object.assign(new EventEmitter(), { send: vi.fn() });
  bounds: Rectangle = { x: 0, y: 0, width: 1, height: 1 };
  showInactiveCount = 0;
  loadFileCount = 0;
  ignored = false;
  destroyed = false;
  focusedSurface = "other-app";
  lastIgnoreOptions: { forward: boolean } | undefined;
  rendererEvents: string[] = [];
  rendererState: unknown;
  constructor(readonly options: BrowserWindowConstructorOptions) { super(); }
  setBounds(bounds: Rectangle): void { this.bounds = bounds; }
  getBounds(): Rectangle { return this.bounds; }
  setIgnoreMouseEvents(ignore: boolean, options?: { forward: boolean }): void {
    this.ignored = ignore;
    this.lastIgnoreOptions = options;
  }
  async loadFile(): Promise<void> { this.loadFileCount += 1; }
  showInactive(): void { this.showInactiveCount += 1; }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.emit("closed");
  }
  deliverMouse(type: string): string {
    if (this.ignored) return "other-app";
    let prevented = false;
    this.webContents.emit("before-mouse-event", { preventDefault: () => { prevented = true; } }, { type, button: "left" });
    if (prevented) return "prevented";
    if (type === "mouseDown") {
      this.focusedSurface = "pet";
      this.emit("focus");
    }
    this.rendererEvents.push(type);
    return "renderer";
  }
}

function withElectronMock(mock: unknown, run: () => void): void {
  const module = nodeRequire("node:module") as { _load: typeof nodeRequire };
  const originalLoad = module._load;
  module._load = ((request: string, parent: unknown, isMain: boolean) => request === "electron"
    ? mock : originalLoad(request, parent, isMain)) as typeof originalLoad;
  try { run(); } finally { module._load = originalLoad; }
}
