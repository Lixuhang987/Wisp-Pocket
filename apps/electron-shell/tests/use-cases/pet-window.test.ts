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
import { PetWindowCollection } from "../../src/main/windows/petWindowCollection.js";
import { PetPositionStore } from "../../src/main/windows/petPositionStore.js";

const nodeRequire = createRequire(import.meta.url);
const preloadPath = nodeRequire.resolve("../../dist/preload/activityWindowPreload.cjs");
const temporaryDirectories: string[] = [];
const liveWindows: FakeBrowserWindow[] = [];

type PetBridge = {
  setLayout(mode: "pet" | "compact" | "expanded", contentHeight?: number): void;
  setInteractiveRegions(rectangles: Rectangle[]): void;
  beginMove(): void;
  move(): void;
  endMove(): void;
  hidePet(): void;
  setReceiving(receiving: boolean): void;
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
    const openExternal = vi.fn(async (_url: string) => {});
    const harness = await createHarness({ collection: true, openExternal });
    const { window, bridge, screen } = harness;

    expect(window.options).toMatchObject({
      width: 208, height: 208, show: false, frame: false, transparent: true,
      alwaysOnTop: true, skipTaskbar: true, focusable: true,
      acceptFirstMouse: true, resizable: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    expect(window.bounds).toEqual({ x: 990, y: 668, width: 208, height: 208 });
    expect(window.showInactiveCount).toBe(1);
    expect(window.focusedSurface).toBe("other-app");
    expect(harness.mainWorld.handAgentActivityWindowConfig).toEqual({
      petId: "pet-a",
      threadWebSocketURL: "ws://127.0.0.1:4317/api/thread?acceptServerRequests=1",
    });
    expect(Object.keys(bridge).sort()).toEqual([
      "beginMove", "chooseFiles", "endMove", "getPathForFile", "hidePet", "move", "onReveal", "setInteractiveRegions", "setLayout", "setReceiving", "showPet",
    ]);

    const open = window.webContents.setWindowOpenHandler.mock.lastCall![0];
    expect(open({ url: "https://example.com/docs" })).toEqual({ action: "deny" });
    expect(openExternal).toHaveBeenCalledExactlyOnceWith("https://example.com/docs");
    expect(open({ url: "file:///tmp/private" })).toEqual({ action: "deny" });
    expect(openExternal).toHaveBeenCalledTimes(1);
    const preventDefault = vi.fn();
    window.webContents.emit("will-navigate", { preventDefault }, "https://example.com/docs");
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(window.loadFileCount).toBe(1);

    bridge.setLayout("compact");
    expect(window.bounds).toEqual({ x: 990, y: 540, width: 426, height: 336 });
    bridge.setLayout("expanded");
    expect(window.bounds).toEqual({ x: 990, y: 236, width: 426, height: 640 });
    bridge.setInteractiveRegions([
      { x: 208, y: 0, width: 210, height: 412 },
      { x: 72, y: 501, width: 128, height: 139 },
    ]);

    screen.cursor = { x: 1248, y: 286 };
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("mouseDown")).toBe("renderer");
    expect(window.focusedSurface).toBe("pet");
    expect(window.deliverMouse("mouseWheel")).toBe("renderer");
    expect(window.deliverMouse("drop")).toBe("renderer");
    expect(window.rendererEvents).toEqual(["mouseDown", "mouseWheel", "drop"]);

    screen.cursor = { x: 1010, y: 736 };
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("mouseDown")).toBe("other-app");
    expect(window.lastIgnoreOptions).toEqual({ forward: true });

    // 外部应用拖入只改变系统光标；没有 renderer mousemove 也必须恢复 drop 命中。
    screen.cursor = { x: 1120, y: 796 };
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("drop")).toBe("renderer");

    bridge.setReceiving(true);
    bridge.hidePet();
    expect(window.hideCount).toBe(1);
    expect(window.destroyed).toBe(false);
    bridge.setReceiving(false);
    expect(window.destroyed).toBe(true);
    await harness.collection.accept({ type: "thread.started", threadId: "thread-a", payload: { petId: "pet-a" } });
    await harness.collection.accept({
      type: "permission.requested", threadId: "thread-a", requestId: "permission-a",
      timestamp: new Date().toISOString(), payload: {},
    });
    const recalled = harness.petWindows.get("pet-a")!;
    expect(recalled).not.toBe(window);
    expect(recalled.showInactiveCount).toBe(1);
    expect(recalled.focusedSurface).toBe("other-app");
    expect(recalled.webContents.send).toHaveBeenCalledWith("pet-window:reveal");
  });

  it("角色拖动保持捕获，记住位置，关闭 ThreadWindow 后继续使用同一桌宠，再次启动恢复", async () => {
    const harness = await createHarness();
    const { window, bridge, screen, positionPath } = harness;
    bridge.setLayout("expanded");
    bridge.setInteractiveRegions([{ x: 72, y: 501, width: 128, height: 139 }]);
    screen.cursor = { x: 1120, y: 796 };
    bridge.beginMove();
    screen.cursor = { x: 700, y: 696 };
    bridge.move();
    expect(window.bounds).toEqual({ x: 570, y: 136, width: 426, height: 640 });

    // pointer capture 期间即使光标离开已上报 DOM 矩形，也继续交给 renderer。
    screen.cursor = { x: 590, y: 186 };
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("mouseMove")).toBe("renderer");
    screen.cursor = { x: 700, y: 696 };
    bridge.endMove();
    expect(JSON.parse(readFileSync(positionPath, "utf8"))).toEqual({ right: 770, bottom: 776 });

    window.rendererState = { currentThreadId: "thread-1", draft: "继续阅读" };
    harness.runtime.handleThreadWindowClosed({ wasPrepared: true, wasVisible: true });
    bridge.setLayout("pet");
    await harness.controller.show();
    expect(harness.controller.currentWebContents()).toBe(window.webContents);
    expect(window.rendererState).toEqual({ currentThreadId: "thread-1", draft: "继续阅读" });
    expect(window.loadFileCount).toBe(1);
    expect(window.bounds).toEqual({ x: 570, y: 568, width: 208, height: 208 });

    window.destroy();
    const restored = await createHarness({ positionPath });
    expect(restored.window.bounds).toEqual({ x: 570, y: 568, width: 208, height: 208 });
    expect(restored.window.focusedSurface).toBe("other-app");
  });

  it("恢复离屏位置、切换屏幕工作区和展开气泡时，完整窗口保持在可用屏幕内", async () => {
    const positionPath = createPositionPath();
    writeFileSync(positionPath, JSON.stringify({ right: 6200, bottom: 3500 }));
    const screen = new FakeScreen({ x: 0, y: 30, width: 1000, height: 670 });
    const { bridge, window } = await createHarness({ positionPath, screen });
    expect(window.bounds).toEqual({ x: 792, y: 492, width: 208, height: 208 });

    bridge.setLayout("expanded");
    expect(window.bounds).toEqual({ x: 574, y: 60, width: 426, height: 640 });
    screen.workArea = { x: -900, y: 24, width: 900, height: 540 };
    screen.emit("work-area-changed");
    expect(window.bounds).toEqual({ x: -426, y: 24, width: 426, height: 540 });
    bridge.setLayout("pet");
    expect(window.bounds).toEqual({ x: -426, y: 356, width: 208, height: 208 });
    expect(JSON.parse(readFileSync(positionPath, "utf8"))).toEqual({ right: -226, bottom: 564 });

    let displayId = "left-display";
    const relativeScreen = Object.assign(new FakeScreen({x:-1600,y:0,width:1600,height:1000}), {
      getDisplayForPoint: () => ({id:displayId,workArea:relativeScreen.workArea}),
      getWorkAreaForDisplay: (id:string) => id===displayId ? relativeScreen.workArea : undefined,
    });
    const first = await createHarness({screen: relativeScreen});
    const saved = JSON.parse(readFileSync(first.positionPath,"utf8"));
    expect(saved.display).toMatchObject({id:"left-display",x:expect.any(Number),y:expect.any(Number)});
    first.window.destroy();
    relativeScreen.workArea={x:-2000,y:100,width:2000,height:1200};
    const restored=await createHarness({screen: relativeScreen,positionPath:first.positionPath});
    expect(restored.window.bounds.x+200).toBe(Math.round(relativeScreen.workArea.x+saved.display.x*relativeScreen.workArea.width));
    expect(restored.window.bounds.y+restored.window.bounds.height).toBe(Math.round(relativeScreen.workArea.y+saved.display.y*relativeScreen.workArea.height));
    displayId="main-display";relativeScreen.workArea={x:0,y:0,width:1440,height:900};relativeScreen.emit("work-area-changed");
    expect(restored.window.bounds.x).toBeGreaterThanOrEqual(0);expect(restored.window.bounds.y).toBeGreaterThanOrEqual(0);
    expect(restored.window.bounds.x+restored.window.bounds.width).toBeLessThanOrEqual(1440);
    expect(JSON.parse(readFileSync(first.positionPath,"utf8")).display.id).toBe("main-display");
  });

  it("角色在左、对话在右，各布局保持角色右下角锚点", async () => {
    const positionPath = createPositionPath();
    writeFileSync(positionPath, JSON.stringify({ right: 500, bottom: 700 }));
    const screen = new FakeScreen({ x: 0, y: 30, width: 1000, height: 770 });
    const { bridge, window } = await createHarness({ positionPath, screen });
    for (const layout of ["compact", "expanded", "pet"] as const) {
      bridge.setLayout(layout);
      expect(window.bounds.x).toBe(300);
      expect(window.bounds.y + window.bounds.height).toBe(700);
      expect(JSON.parse(readFileSync(positionPath, "utf8"))).toEqual({ right: 500, bottom: 700 });
    }
  });

  it("常态随内容向上收紧或增高，顶部空间不足时裁剪且保留回复框和角色锚点", async () => {
    const positionPath = createPositionPath();
    writeFileSync(positionPath, JSON.stringify({ right: 500, bottom: 440 }));
    const screen = new FakeScreen({ x: 0, y: 30, width: 1000, height: 670 });
    const { bridge, window } = await createHarness({ positionPath, screen });
    bridge.setLayout("compact", 240);
    expect(window.bounds).toEqual({ x: 300, y: 200, width: 426, height: 240 });
    bridge.setLayout("compact", 600);
    expect(window.bounds).toEqual({ x: 300, y: 30, width: 426, height: 410 });
    bridge.setLayout("expanded");
    expect(window.bounds).toEqual({ x: 300, y: 30, width: 426, height: 410 });
    bridge.setLayout("compact", 180);
    expect(window.bounds).toEqual({ x: 300, y: 232, width: 426, height: 208 });
    expect(JSON.parse(readFileSync(positionPath, "utf8"))).toEqual({ right: 500, bottom: 440 });
  });

  it("靠近上边缘悬停时缩短历史窗口，回复框与角色的底部锚点保持原位", async () => {
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
    const { bridge, window, ipcMain, screen, petWindows } = await createHarness({ positionPath, collection: true, secondPet: true });
    bridge.setLayout("compact");
    const expectedBounds = { ...window.bounds };
    ipcMain.emit("pet-window:set-layout", { sender: {} }, "expanded");
    ipcMain.emit("pet-window:set-layout", { sender: window.webContents }, { width: 9000 });
    ipcMain.emit("pet-window:set-layout", { sender: window.webContents }, "compact", Number.NaN);
    ipcMain.emit("pet-window:set-layout", { sender: window.webContents }, "compact", -1);
    ipcMain.emit("pet-window:begin-move", { sender: window.webContents }, { x: -3000 });
    screen.cursor = { x: -3000, y: -3000 };
    bridge.move();
    expect(window.bounds).toEqual(expectedBounds);

    bridge.setInteractiveRegions([{ x: 208, y: 0, width: 210, height: 100 }]);
    screen.cursor = { x: window.bounds.x + 240, y: window.bounds.y + 40 };
    ipcMain.emit("pet-window:set-interactive-regions", { sender: window.webContents }, [
      { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 100 },
    ]);
    vi.advanceTimersByTime(32);
    expect(window.deliverMouse("mouseDown")).toBe("renderer");
    bridge.setLayout("pet");
    expect(window.bounds).toEqual({ x: 990, y: 668, width: 208, height: 208 });

    const other = petWindows.get("pet-b")!;
    const otherBounds = { ...other.bounds };
    ipcMain.emit("pet-window:begin-move", { sender: window.webContents });
    screen.cursor = { x: -2900, y: -2900 };
    ipcMain.emit("pet-window:move", { sender: window.webContents }, "pet-b");
    expect(window.bounds).toEqual({ x: 990, y: 668, width: 208, height: 208 });
    ipcMain.emit("pet-window:move", { sender: window.webContents });
    expect(window.bounds).not.toEqual({ x: 990, y: 668, width: 208, height: 208 });
    expect(other.bounds).toEqual(otherBounds);
    ipcMain.emit("pet-window:hide", { sender: window.webContents }, "pet-b");
    ipcMain.emit("pet-window:hide", { sender: {} });
    expect(window.hideCount).toBe(0);
    expect(other.hideCount).toBe(0);
    bridge.hidePet();
    expect(window.destroyed).toBe(true);
    expect(other.destroyed).toBe(false);
  });
});

async function createHarness(options: { positionPath?: string; screen?: FakeScreen; collection?: boolean; secondPet?: boolean; openExternal?: (url: string) => Promise<void> } = {}) {
  const positionPath = options.positionPath ?? createPositionPath();
  const screen = options.screen ?? new FakeScreen();
  let window!: FakeBrowserWindow;
  const petWindows = new Map<string, FakeBrowserWindow>();
  const controller = new ActivityWindowController({
    activityWindowHTMLPath: "/dist/activity-window/index.html",
    preloadPath,
    positionStore: new PetPositionStore(positionPath),
    petId: options.collection ? "pet-a" : undefined,
    screenProvider: screen,
    openExternal: options.openExternal,
    createWindow: (windowOptions) => {
      window = new FakeBrowserWindow(windowOptions);
      liveWindows.push(window);
      petWindows.set("pet-a", window);
      return window;
    },
  });
  const collection = new PetWindowCollection({
    url: "ws://local/api/thread", preferences: { load: () => ({}), save: vi.fn() },
    createController: petId => petId === "pet-a" ? controller : new ActivityWindowController({
      activityWindowHTMLPath: "/dist/activity-window/index.html", preloadPath, petId,
      positionStore: new PetPositionStore(createPositionPath()), screenProvider: screen,
      createWindow: windowOptions => {
        const other = new FakeBrowserWindow(windowOptions);
        liveWindows.push(other);
        petWindows.set(petId, other);
        return other;
      },
    }),
  });
  const ipcMain = new EventEmitter();
  registerPetWindowIpc(ipcMain, options.collection ? collection : controller);
  const runtime = new ElectronShellRuntime({
    activityWindow: controller,
    prewarmer: {
      prepare: async () => {}, openInitialPrompt: async () => {}, openHistory: async () => {},
      focus: () => true, updateTheme: async () => {},
    },
    send: () => {}, now: () => "2026-09-13T00:00:00.000Z", stopSupervisor: () => {}, quit: () => {},
  });
  if (options.collection) await collection.accept({ type: "pet.listed", payload: { pets: [{ id: "pet-a" }, ...(options.secondPet ? [{ id: "pet-b" }] : [])] } });
  else await runtime.handleCommand({ channel: "electron_shell", type: "activity_window.show", commandId: "show-pet" });
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
  return { controller, collection, petWindows, runtime, window, screen, positionPath, ipcMain, mainWorld, bridge: mainWorld.handAgentPet as PetBridge };
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
  webContents = Object.assign(new EventEmitter(), { send: vi.fn(), setWindowOpenHandler: vi.fn<(handler: (details: { url: string }) => { action: "deny" }) => void>() });
  bounds: Rectangle = { x: 0, y: 0, width: 1, height: 1 };
  showInactiveCount = 0;
  hideCount = 0;
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
  hide(): void { this.hideCount += 1; }
  close(): void { this.destroy(); }
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
