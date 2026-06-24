import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nodeRequire = createRequire(import.meta.url);
const preloadPath = nodeRequire.resolve("../../dist/preload/threadWindowPreload.cjs");

type MainWorldScript = {
  func: (
    url: string,
    theme: HostTheme,
    skills: Array<{ actionId: string; title: string; prompt: string; description?: string }>,
    dynamicTools: DynamicToolSpec[],
  ) => void;
  args: [
    string,
    HostTheme,
    Array<{ actionId: string; title: string; prompt: string; description?: string }>,
    DynamicToolSpec[],
  ];
};

type HostTheme = {
  preference: "light" | "dark" | "system";
  resolved: "light" | "dark";
};

type DynamicToolSpec = {
  clientId: string;
  namespace?: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type ThreadWindowGlobals = {
    handAgentThreadWindowConfig?: {
      threadWebSocketURL?: string;
      availableSkills?: Array<{ actionId: string; title: string; prompt: string; description?: string }>;
      defaultDynamicTools?: DynamicToolSpec[];
    };
  handAgentTheme?: HostTheme;
  handAgentSubscribeThemeChange?: (handler: (theme: HostTheme) => void) => () => void;
  handAgentPendingInitialPrompts?: unknown[];
  handAgentReceiveInitialPrompt?: (payload: unknown) => void;
};

describe("threadWindowPreload", () => {
  beforeEach(() => {
    vi.resetModules();
    delete nodeRequire.cache[preloadPath];
    delete (globalThis as { window?: ThreadWindowGlobals }).window;
    process.argv = process.argv.filter((arg) => !arg.startsWith("--handagent-theme="));
    process.argv = process.argv.filter((arg) => !arg.startsWith("--handagent-default-dynamic-tools="));
  });

  it("installs thread window globals in the renderer main world", async () => {
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    withElectronMock({ contextBridge, ipcRenderer: createIpcRendererMock() }, () => {
      nodeRequire(preloadPath);
    });

    expect(contextBridge.executeInMainWorld).toHaveBeenCalledTimes(1);
    const script = contextBridge.executeInMainWorld.mock.calls[0]?.[0] as MainWorldScript;
    const mainWorld: ThreadWindowGlobals = {};
    (globalThis as { window?: ThreadWindowGlobals }).window = mainWorld;

    script.func(...script.args);
    mainWorld.handAgentReceiveInitialPrompt?.({ clientRequestId: "prompt-1" });

    expect(mainWorld.handAgentThreadWindowConfig?.threadWebSocketURL).toBe(
      "ws://127.0.0.1:4317/api/thread?subscribeNewThreads=1",
    );
    expect(mainWorld.handAgentTheme).toEqual({ preference: "system", resolved: "light" });
    expect(mainWorld.handAgentPendingInitialPrompts).toEqual([{ clientRequestId: "prompt-1" }]);
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith("handAgentElectron", {
      phase: "phase-0",
    });
  });

  it("preserves an existing main-world initial prompt receiver", async () => {
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    withElectronMock({ contextBridge, ipcRenderer: createIpcRendererMock() }, () => {
      nodeRequire(preloadPath);
    });

    const script = contextBridge.executeInMainWorld.mock.calls[0]?.[0] as MainWorldScript;
    const receiver = vi.fn();
    const pending = [{ clientRequestId: "early-prompt" }];
    const mainWorld: ThreadWindowGlobals = {
      handAgentPendingInitialPrompts: pending,
      handAgentReceiveInitialPrompt: receiver,
    };
    (globalThis as { window?: ThreadWindowGlobals }).window = mainWorld;

    script.func(...script.args);
    mainWorld.handAgentReceiveInitialPrompt?.({ clientRequestId: "prompt-2" });

    expect(mainWorld.handAgentPendingInitialPrompts).toBe(pending);
    expect(receiver).toHaveBeenCalledWith({ clientRequestId: "prompt-2" });
  });

  it("reads the initial theme from preload arguments", async () => {
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    process.argv.push(`--handagent-theme=${encodeURIComponent(JSON.stringify({ preference: "dark", resolved: "dark" }))}`);
    withElectronMock({ contextBridge, ipcRenderer: createIpcRendererMock() }, () => {
      nodeRequire(preloadPath);
    });

    const script = contextBridge.executeInMainWorld.mock.calls[0]?.[0] as MainWorldScript;
    const mainWorld: ThreadWindowGlobals = {};
    (globalThis as { window?: ThreadWindowGlobals }).window = mainWorld;

    script.func(...script.args);

    expect(mainWorld.handAgentTheme).toEqual({ preference: "dark", resolved: "dark" });
  });

  it("reads available skills from preload arguments", async () => {
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    process.argv.push(`--handagent-available-skills=${encodeURIComponent(JSON.stringify([
      { actionId: "review/code", title: "Review", prompt: "Review this code" },
    ]))}`);
    withElectronMock({ contextBridge, ipcRenderer: createIpcRendererMock() }, () => {
      nodeRequire(preloadPath);
    });

    const script = contextBridge.executeInMainWorld.mock.calls[0]?.[0] as MainWorldScript;
    const mainWorld: ThreadWindowGlobals = {};
    (globalThis as { window?: ThreadWindowGlobals }).window = mainWorld;

    script.func(...script.args);

    expect(mainWorld.handAgentThreadWindowConfig?.availableSkills).toEqual([
      { actionId: "review/code", title: "Review", prompt: "Review this code" },
    ]);
  });

  it("reads default dynamic tools from preload arguments", async () => {
    const contextBridge = {
      executeInMainWorld: vi.fn(),
      exposeInMainWorld: vi.fn(),
    };
    process.argv.push(`--handagent-default-dynamic-tools=${encodeURIComponent(JSON.stringify([
      {
        clientId: "swift-host",
        namespace: "host_macos",
        name: "screen_capture",
        description: "Capture screen",
        inputSchema: { type: "object", properties: {} },
      },
    ]))}`);
    withElectronMock({ contextBridge, ipcRenderer: createIpcRendererMock() }, () => {
      nodeRequire(preloadPath);
    });

    const script = contextBridge.executeInMainWorld.mock.calls[0]?.[0] as MainWorldScript;
    const mainWorld: ThreadWindowGlobals = {};
    (globalThis as { window?: ThreadWindowGlobals }).window = mainWorld;

    script.func(...script.args);

    expect(mainWorld.handAgentThreadWindowConfig?.defaultDynamicTools).toEqual([
      {
        clientId: "swift-host",
        namespace: "host_macos",
        name: "screen_capture",
        description: "Capture screen",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
  });

  it("exposes a validated theme change subscription", async () => {
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
    const unsubscribe = exposed?.(handler);

    ipcRenderer.emit("handagent:theme-changed", {}, { preference: "light", resolved: "light" });
    ipcRenderer.emit("handagent:theme-changed", {}, { preference: "system", resolved: "system" });
    unsubscribe?.();
    ipcRenderer.emit("handagent:theme-changed", {}, { preference: "dark", resolved: "dark" });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { preference: "system", resolved: "light" });
    expect(handler).toHaveBeenNthCalledWith(2, { preference: "light", resolved: "light" });
  });

  it("replays the latest theme received before subscription", async () => {
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
});

function createIpcRendererMock() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      listeners.set(channel, listeners.get(channel) ?? new Set());
      listeners.get(channel)?.add(listener);
    }),
    off: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      listeners.get(channel)?.delete(listener);
    }),
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
