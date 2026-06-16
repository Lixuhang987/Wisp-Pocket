import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nodeRequire = createRequire(import.meta.url);
const preloadPath = nodeRequire.resolve("../../dist/preload/activityWindowPreload.cjs");

type MainWorldScript = {
  func: (url: string, theme: HostTheme) => void;
  args: [string, HostTheme];
};

type ActivityWindowGlobals = {
  handAgentActivityWindowConfig?: { activityWebSocketURL?: string };
  handAgentTheme?: HostTheme;
  handAgentSubscribeThemeChange?: (handler: (theme: HostTheme) => void) => () => void;
};

type HostTheme = {
  preference: "light" | "dark" | "system";
  resolved: "light" | "dark";
};

describe("activityWindowPreload", () => {
  beforeEach(() => {
    vi.resetModules();
    delete nodeRequire.cache[preloadPath];
    delete (globalThis as { window?: ActivityWindowGlobals }).window;
    process.argv = process.argv.filter((arg) => !arg.startsWith("--handagent-theme="));
  });

  it("installs activity window config in the renderer main world", async () => {
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    const ipcRenderer = createIpcRendererMock();
    withElectronMock({ contextBridge, ipcRenderer }, () => {
      nodeRequire(preloadPath);
    });

    expect(contextBridge.executeInMainWorld).toHaveBeenCalledTimes(1);
    const script = contextBridge.executeInMainWorld.mock.calls[0]?.[0] as MainWorldScript;
    const mainWorld: ActivityWindowGlobals = {};
    (globalThis as { window?: ActivityWindowGlobals }).window = mainWorld;

    script.func(...script.args);

    expect(mainWorld.handAgentActivityWindowConfig?.activityWebSocketURL).toBe(
      "ws://127.0.0.1:4317/api/activity",
    );
    expect(mainWorld.handAgentTheme).toEqual({ preference: "system", resolved: "light" });
  });

  it("reads the initial host theme from additional arguments", async () => {
    const theme: HostTheme = { preference: "dark", resolved: "dark" };
    process.argv.push(`--handagent-theme=${encodeURIComponent(JSON.stringify(theme))}`);
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    const ipcRenderer = createIpcRendererMock();
    withElectronMock({ contextBridge, ipcRenderer }, () => {
      nodeRequire(preloadPath);
    });

    const script = contextBridge.executeInMainWorld.mock.calls[0]?.[0] as MainWorldScript;
    const mainWorld: ActivityWindowGlobals = {};
    (globalThis as { window?: ActivityWindowGlobals }).window = mainWorld;

    script.func(...script.args);

    expect(mainWorld.handAgentTheme).toEqual(theme);
  });

  it("exposes a filtered host theme subscription", async () => {
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    const ipcRenderer = createIpcRendererMock();
    withElectronMock({ contextBridge, ipcRenderer }, () => {
      nodeRequire(preloadPath);
    });

    const exposed = contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === "handAgentSubscribeThemeChange")?.[1] as
      | ((handler: (theme: HostTheme) => void) => () => void)
      | undefined;
    expect(exposed).toBeTypeOf("function");
    const handler = vi.fn();
    const dispose = exposed?.(handler);

    ipcRenderer.emit("handagent:theme-changed", {}, { preference: "light", resolved: "light" });
    ipcRenderer.emit("handagent:theme-changed", {}, { preference: "system", resolved: "system" });
    ipcRenderer.emit("handagent:theme-changed", {}, { preference: "dark", resolved: "dark" });
    dispose?.();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, { preference: "system", resolved: "light" });
    expect(handler).toHaveBeenNthCalledWith(2, { preference: "light", resolved: "light" });
    expect(handler).toHaveBeenNthCalledWith(3, { preference: "dark", resolved: "dark" });
  });

  it("replays the latest host theme received before subscription", async () => {
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    const ipcRenderer = createIpcRendererMock();
    withElectronMock({ contextBridge, ipcRenderer }, () => {
      nodeRequire(preloadPath);
    });
    ipcRenderer.emit("handagent:theme-changed", {}, { preference: "dark", resolved: "dark" });

    const exposed = contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === "handAgentSubscribeThemeChange")?.[1] as
      | ((handler: (theme: HostTheme) => void) => () => void)
      | undefined;
    const handler = vi.fn();
    exposed?.(handler);

    expect(handler).toHaveBeenCalledWith({ preference: "dark", resolved: "dark" });
  });

  it("exposes a focusThread bridge that sends focus requests to main", async () => {
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    const ipcRenderer = createIpcRendererMock();
    withElectronMock({ contextBridge, ipcRenderer }, () => {
      nodeRequire(preloadPath);
    });

    const [name, api] = contextBridge.exposeInMainWorld.mock.calls.find(([exposedName]) => exposedName === "handAgentActivityWindow") ?? [];
    expect(name).toBe("handAgentActivityWindow");

    (api as { focusThread(threadId: string | null): void }).focusThread("thread-1");
    (api as { focusThread(threadId: string | null): void }).focusThread(null);

    expect(ipcRenderer.send).toHaveBeenCalledWith("activity-window:focus-thread", "thread-1");
    expect(ipcRenderer.send).toHaveBeenCalledWith("activity-window:focus-thread", null);
  });
});

function createIpcRendererMock() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      listeners.set(channel, listeners.get(channel) ?? new Set());
      listeners.get(channel)?.add(listener);
    }),
    send: vi.fn(),
    emit: (channel: string, ...args: unknown[]) => {
      for (const listener of listeners.get(channel) ?? []) {
        listener(...args);
      }
    },
  };
}

function withElectronMock(mock: unknown, run: () => void): void {
  const moduleAny = nodeRequire("node:module") as { _load: typeof nodeRequire };
  const originalLoad = moduleAny._load;
  moduleAny._load = ((request: string, parent: unknown, isMain: boolean) => {
    if (request === "electron") {
      return mock;
    }
    return originalLoad(request, parent, isMain);
  }) as typeof originalLoad;
  try {
    run();
  } finally {
    moduleAny._load = originalLoad;
  }
}
