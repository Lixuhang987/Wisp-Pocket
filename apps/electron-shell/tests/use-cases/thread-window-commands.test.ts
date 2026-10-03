import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { ElectronShellRuntime } from "../../src/main/electronShellRuntime.js";
import { parseCommand, type ElectronToSwiftEvent } from "../../src/main/protocol/electronShellProtocol.js";
import { registerSettingsManagementIpc } from "../../src/main/settingsManagementIpc.js";
import { ThreadWindowPrewarmer } from "../../src/main/windows/threadWindowPrewarmer.js";

describe("Swift targeted ThreadWindow focus", () => {
  it.each(["hidden", "visible", "recreated"])("delivers the selected Thread before showing a %s window", async (state) => {
    const windows = [new FakeBrowserWindow(), new FakeBrowserWindow()];
    let nextWindow = 0;
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.cjs", availableSkills: [],
      createWindow: () => windows[nextWindow++],
    });
    const prepared = prewarmer.prepare();
    windows[0].webContents.emit("did-finish-load");
    await prepared;
    if (state !== "hidden") await prewarmer.openHistory();
    if (state === "recreated") windows[0].emit("closed");

    const targetWindow = windows[state === "recreated" ? 1 : 0];
    const previousShowCount = targetWindow.showCount;
    const received: string[] = [];
    targetWindow.webContents.executeJavaScript = async (source) => {
      targetWindow.executedJavaScript.push(source);
      runInNewContext(source, { window: { handAgentReceiveThreadOpen: (threadId: string) => {
        expect(targetWindow.showCount).toBe(previousShowCount);
        received.push(threadId);
      } } });
    };
    const { runtime, events } = createRuntime(prewarmer);
    const threadId = "thread-</script>\"\\\n-target";
    const opening = runtime.handleCommand(parseCommand(JSON.stringify({
      channel: "electron_shell", type: "thread_window.focus", commandId: "focus-target", threadId,
    })));
    if (state === "recreated") targetWindow.webContents.emit("did-finish-load");
    await opening;

    expect(received).toEqual([threadId]);
    expect(targetWindow.executedJavaScript[0]).not.toContain("</script>");
    expect(targetWindow.showCount).toBe(previousShowCount + 1);
    expect(targetWindow.focusCount).toBe(previousShowCount + 1);
    expect(targetWindow.loadCount).toBe(1);
    expect(events).toEqual([{
      channel: "electron_shell", type: "command.ack", commandId: "focus-target", ok: true,
    }]);
  });

  it("reports failed renderer delivery without showing or acknowledging success", async () => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.cjs", availableSkills: [], createWindow: () => window,
    });
    window.webContents.executeJavaScript = async () => { throw new Error("renderer delivery failed"); };
    const { runtime, events } = createRuntime(prewarmer);
    const opening = runtime.handleCommand(parseCommand(JSON.stringify({
      channel: "electron_shell", type: "thread_window.focus", commandId: "focus-failed", threadId: "thread-a",
    })));
    window.webContents.emit("did-finish-load");
    await opening;

    expect(events).toEqual([{
      channel: "electron_shell", type: "command.ack", commandId: "focus-failed", ok: false,
      error: "renderer delivery failed",
    }]);
    expect(window.showCount).toBe(0);
    expect(window.focusCount).toBe(0);
  });

  it("keeps a replacement window independent when the target closes during delivery", async () => {
    const first = new FakeBrowserWindow();
    const second = new FakeBrowserWindow();
    const windows = [first, second];
    const injected = createDeferred<void>();
    first.webContents.executeJavaScript = async (source) => {
      first.executedJavaScript.push(source);
      await injected.promise;
    };
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.cjs", availableSkills: [], createWindow: () => windows.shift()!,
    });
    const { runtime, events } = createRuntime(prewarmer);
    const opening = runtime.handleCommand(parseCommand(JSON.stringify({
      channel: "electron_shell", type: "thread_window.focus", commandId: "focus-closed", threadId: "thread-a",
    })));
    first.webContents.emit("did-finish-load");
    await flushMicrotasks();
    expect(first.executedJavaScript[0]).toContain("handAgentReceiveThreadOpen");
    expect(events).toEqual([]);
    first.emit("closed");
    const history = prewarmer.openHistory();
    second.webContents.emit("did-finish-load");
    await history;
    injected.resolve();
    await opening;

    expect(events).toMatchObject([{
      type: "command.ack", commandId: "focus-closed", ok: false,
    }]);
    expect(first.showCount).toBe(0);
    expect(second.showCount).toBe(1);
    expect(second.executedJavaScript).toEqual([]);
  });

  it.each([undefined, null])("preserves window-only focus when threadId is %s", async (threadId) => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.cjs", availableSkills: [], createWindow: () => window,
    });
    const { runtime, events } = createRuntime(prewarmer);
    const command = parseCommand(JSON.stringify({
      channel: "electron_shell", type: "thread_window.focus", commandId: "focus-window", threadId,
    }));
    const opening = runtime.handleCommand(command);
    window.webContents.emit("did-finish-load");
    await opening;
    await runtime.handleCommand(command);

    expect(window.executedJavaScript).toEqual([]);
    expect(window.showCount).toBe(1);
    expect(window.focusCount).toBe(2);
    expect(events).toEqual(Array(2).fill({
      channel: "electron_shell", type: "command.ack", commandId: "focus-window", ok: true,
    }));
  });
});

describe("Settings window command", () => {
  it("opens one independent settings renderer, focuses it unchanged and recreates after close", async () => {
    const windows = [new FakeBrowserWindow(), new FakeBrowserWindow()];
    const created: unknown[] = [];
    let index = 0;
    const settingsWindow = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html?surface=settings",
      preloadPath: "/preload.cjs", availableSkills: [],
      createWindow: options => { created.push(options); return windows[index++]; },
    });
    const threadWindow = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.cjs", availableSkills: [],
      createWindow: () => { throw new Error("Settings must own a separate window"); },
    });
    const events: ElectronToSwiftEvent[] = [];
    let stopped = false;
    const runtime = new ElectronShellRuntime({
      prewarmer: threadWindow, settingsWindow,
      activityWindow: { show: async () => {}, updateTheme: async () => {} },
      send: event => events.push(event), now: () => "now",
      stopSupervisor: () => { stopped = true; }, quit: () => {},
    });
    const command = parseCommand(JSON.stringify({channel:"electron_shell",type:"settings.open",commandId:"settings-1"}));
    const opening = runtime.handleCommand(command);
    windows[0].webContents.emit("did-finish-load");
    await opening;
    await runtime.handleCommand(command);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({webPreferences:{contextIsolation:true,nodeIntegration:false,preload:"/preload.cjs"}});
    expect(windows[0].loadCount).toBe(1);
    expect(windows[0].showCount).toBe(1);
    expect(windows[0].focusCount).toBe(2);
    expect(windows[0].executedJavaScript).toEqual([]);
    const handlers = new Map<string, (event: {sender:unknown}, ...args: unknown[]) => unknown>();
    const visibility: Record<string, boolean> = { "pet-a": true };
    registerSettingsManagementIpc({handle:(channel, handler) => {handlers.set(channel, handler);}}, {
      isManagementSender: sender => settingsWindow.ownsSender(sender),
      chooseDirectory: async () => "/project", chooseImage: async () => ({name:"pet.png",mimeType:"image/png",bytesBase64:"cG5n"}),
      showPet: async id => {visibility[id] = true;}, hidePet: async id => {visibility[id] = false;},
      getPetVisibility: () => ({...visibility}),
    });
    const event = {sender: windows[0].webContents};
    expect(await handlers.get("settings:choose-directory")!(event)).toBe("/project");
    expect(await handlers.get("settings:choose-image")!(event)).toMatchObject({mimeType:"image/png",bytesBase64:"cG5n"});
    await handlers.get("settings:hide-pet")!(event, "pet-a");
    expect(handlers.get("settings:pet-visibility")!(event)).toEqual({"pet-a": false});
    await handlers.get("settings:show-pet")!(event, "pet-a");
    expect(handlers.get("settings:pet-visibility")!(event)).toEqual({"pet-a": true});
    expect(() => handlers.get("settings:choose-directory")!({sender:{}})).toThrow("Invalid settings window sender");

    windows[0].emit("closed");
    expect(stopped).toBe(false);
    expect(() => handlers.get("settings:choose-directory")!(event)).toThrow("Invalid settings window sender");
    const reopening = runtime.handleCommand(command);
    windows[1].webContents.emit("did-finish-load");
    await reopening;
    expect(created).toHaveLength(2);
    expect(windows[1].loadCount).toBe(1);
    expect(events).toEqual(Array(3).fill({channel:"electron_shell",type:"command.ack",commandId:"settings-1",ok:true}));
  });
});

function createRuntime(prewarmer: ThreadWindowPrewarmer) {
  const events: ElectronToSwiftEvent[] = [];
  const runtime = new ElectronShellRuntime({
    prewarmer,
    activityWindow: { show: async () => {}, updateTheme: async () => {} },
    send: (event) => events.push(event), now: () => "2026-09-14T04:00:00.000Z",
    stopSupervisor: () => {}, quit: () => {},
  });
  return { runtime, events };
}

describe("ThreadWindowPrewarmer", () => {
  it("creates a hidden browser window and waits for load", async () => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/repo/apps/electron-shell/dist/preload/threadWindowPreload.cjs",
      availableSkills: [],
      createWindow: (options) => {
        expect(options.show).toBe(false);
        expect(options.webPreferences?.contextIsolation).toBe(true);
        expect(options.webPreferences?.nodeIntegration).toBe(false);
        expect(options.webPreferences?.additionalArguments?.some((arg) => (
          arg.startsWith("--handagent-default-dynamic-tools=")
        ))).toBe(false);
        return window;
      },
    });

    const prepared = prewarmer.prepare();
    window.webContents.emit("did-finish-load");
    await prepared;

    expect(window.loadedURL).toBe("http://127.0.0.1:4317/thread-window/index.html");
    expect(window.showCount).toBe(0);
    expect(window.focusCount).toBe(0);
  });

  it("passes the current theme to newly created windows", async () => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/repo/apps/electron-shell/dist/preload/threadWindowPreload.cjs",
      availableSkills: [],
      createWindow: (options) => {
        expect(options.webPreferences?.additionalArguments).toContain(
          `--handagent-theme=${encodeURIComponent(JSON.stringify({ preference: "system", resolved: "dark" }))}`,
        );
        return window;
      },
    });

    await prewarmer.updateTheme({ preference: "system", resolved: "dark" });
    const prepared = prewarmer.prepare();
    window.webContents.emit("did-finish-load");
    await prepared;
  });

  it("passes the initial theme to the first created window", async () => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/repo/apps/electron-shell/dist/preload/threadWindowPreload.cjs",
      availableSkills: [],
      initialTheme: { preference: "light", resolved: "light" },
      createWindow: (options) => {
        expect(options.webPreferences?.additionalArguments).toContain(
          `--handagent-theme=${encodeURIComponent(JSON.stringify({ preference: "light", resolved: "light" }))}`,
        );
        return window;
      },
    });

    const prepared = prewarmer.prepare();
    window.webContents.emit("did-finish-load");
    await prepared;
  });

  it("broadcasts theme changes to a prepared window", async () => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      availableSkills: [],
      createWindow: () => window,
    });

    const prepared = prewarmer.prepare();
    window.webContents.emit("did-finish-load");
    await prepared;
    await prewarmer.updateTheme({ preference: "dark", resolved: "dark" });

    expect(window.sentMessages).toEqual([
      ["handagent:theme-changed", { preference: "dark", resolved: "dark" }],
    ]);
  });

  it("broadcasts an in-flight theme change after the existing window finishes loading", async () => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      availableSkills: [],
      createWindow: () => window,
    });

    const prepared = prewarmer.prepare();
    await prewarmer.updateTheme({ preference: "dark", resolved: "dark" });
    expect(window.sentMessages).toEqual([]);

    window.webContents.emit("did-finish-load");
    await prepared;

    expect(window.sentMessages).toEqual([
      ["handagent:theme-changed", { preference: "dark", resolved: "dark" }],
    ]);
  });

  it("delivers initial prompt before showing the prepared window", async () => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      availableSkills: [],
      createWindow: () => window,
    });
    const prepared = prewarmer.prepare();
    window.webContents.emit("did-finish-load");
    await prepared;

    await prewarmer.openInitialPrompt({
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    });

    expect(window.executedJavaScript[0]).toContain("window.handAgentReceiveInitialPrompt");
    expect(window.showCount).toBe(1);
    expect(window.focusCount).toBe(1);
  });

  it("prepares on demand before opening an initial prompt", async () => {
    const window = new FakeBrowserWindow();
    const host = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      availableSkills: [],
      createWindow: () => window,
    });

    const opened = host.openInitialPrompt({
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    });
    window.webContents.emit("did-finish-load");
    await opened;

    expect(window.loadCount).toBe(1);
    expect(window.executedJavaScript[0]).toContain("window.handAgentReceiveInitialPrompt");
    expect(window.showCount).toBe(1);
    expect(window.focusCount).toBe(1);
  });

  it("does not show a replacement window after the initial prompt window closes during delivery", async () => {
    const firstWindow = new FakeBrowserWindow();
    const secondWindow = new FakeBrowserWindow();
    const injected = createDeferred<void>();
    firstWindow.webContents.executeJavaScript = async (source: string) => {
      firstWindow.executedJavaScript.push(source);
      await injected.promise;
    };
    const windows = [firstWindow, secondWindow];
    let createCount = 0;
    const host = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      availableSkills: [],
      createWindow: () => {
        createCount += 1;
        const window = windows.shift();
        if (!window) {
          throw new Error("unexpected createWindow");
        }
        return window;
      },
    });

    const openingInitialPrompt = host.openInitialPrompt({
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    });
    firstWindow.webContents.emit("did-finish-load");
    await flushMicrotasks();

    expect(firstWindow.executedJavaScript[0]).toContain("window.handAgentReceiveInitialPrompt");
    firstWindow.emit("closed");

    const openingHistory = host.openHistory();
    secondWindow.webContents.emit("did-finish-load");
    await openingHistory;

    injected.resolve();
    await expect(openingInitialPrompt).rejects.toThrow("thread window changed before initial prompt was shown");
    expect(firstWindow.showCount).toBe(0);
    expect(firstWindow.focusCount).toBe(0);
    expect(secondWindow.showCount).toBe(1);
    expect(secondWindow.focusCount).toBe(1);
    expect(createCount).toBe(2);
  });

  it("opens history without delivering an initial prompt", async () => {
    const window = new FakeBrowserWindow();
    const host = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      availableSkills: [],
      createWindow: () => window,
    });

    const opened = host.openHistory();
    window.webContents.emit("did-finish-load");
    await opened;

    expect(window.executedJavaScript).toEqual([]);
    expect(window.showCount).toBe(1);
    expect(window.focusCount).toBe(1);
  });

  it("focuses only after the window has been shown", async () => {
    const window = new FakeBrowserWindow();
    const host = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      availableSkills: [],
      createWindow: () => window,
    });

    expect(host.focus()).toBe(false);
    const opened = host.openHistory();
    window.webContents.emit("did-finish-load");
    await opened;

    expect(host.focus()).toBe(true);
    expect(window.focusCount).toBe(2);
  });

  it("reports whether a closed thread window had been visible", async () => {
    const window = new FakeBrowserWindow();
    const closes: boolean[] = [];
    const host = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      availableSkills: [],
      createWindow: () => window,
      onClosed: (event) => closes.push(event.wasVisible),
    });

    const opened = host.openHistory();
    window.webContents.emit("did-finish-load");
    await opened;
    window.emit("closed");

    expect(closes).toEqual([true]);
  });

  it("reuses an in-flight prepare request", async () => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      availableSkills: [],
      createWindow: () => window,
    });

    const firstPrepare = prewarmer.prepare();
    const secondPrepare = prewarmer.prepare();
    window.webContents.emit("did-finish-load");
    await Promise.all([firstPrepare, secondPrepare]);

    expect(window.loadCount).toBe(1);
  });

  it("rejects failed loads and allows a later retry", async () => {
    const window = new FakeBrowserWindow();
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      createWindow: () => window,
    });

    const failedPrepare = prewarmer.prepare();
    window.webContents.emit("did-fail-load");
    await expect(failedPrepare).rejects.toThrow("thread window failed to load");

    const retriedPrepare = prewarmer.prepare();
    window.webContents.emit("did-finish-load");
    await retriedPrepare;

    expect(window.loadCount).toBe(2);
  });

  it("resets state and notifies when a prepared window closes", async () => {
    const firstWindow = new FakeBrowserWindow();
    const secondWindow = new FakeBrowserWindow();
    const windows = [firstWindow, secondWindow];
    let createCount = 0;
    let closedCount = 0;
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      createWindow: () => {
        createCount += 1;
        const window = windows.shift();
        if (!window) {
          throw new Error("unexpected createWindow");
        }
        return window;
      },
      onClosed: () => {
        closedCount += 1;
      },
    });
    const prepared = prewarmer.prepare();
    firstWindow.webContents.emit("did-finish-load");
    await prepared;

    firstWindow.emit("closed");

    expect(closedCount).toBe(1);
    const reopened = prewarmer.openInitialPrompt({
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    });
    secondWindow.webContents.emit("did-finish-load");
    await reopened;

    expect(firstWindow.loadCount).toBe(1);
    expect(firstWindow.showCount).toBe(0);
    expect(firstWindow.focusCount).toBe(0);
    expect(secondWindow.loadCount).toBe(1);
    expect(secondWindow.showCount).toBe(1);
    expect(secondWindow.focusCount).toBe(1);
    expect(createCount).toBe(2);
  });

  it("rejects in-flight prepare when the window closes and allows retry", async () => {
    const windows = [new FakeBrowserWindow(), new FakeBrowserWindow()];
    const prewarmer = new ThreadWindowPrewarmer({
      threadWindowURL: "http://127.0.0.1:4317/thread-window/index.html",
      preloadPath: "/preload.js",
      createWindow: () => {
        const window = windows.shift();
        if (!window) {
          throw new Error("unexpected createWindow");
        }
        return window;
      },
    });

    const firstWindow = windows[0];
    const failedPrepare = prewarmer.prepare();
    firstWindow?.emit("closed");
    await expect(failedPrepare).rejects.toThrow("thread window closed before it was prepared");

    const secondWindow = windows[0];
    const retriedPrepare = prewarmer.prepare();
    secondWindow?.webContents.emit("did-finish-load");
    await retriedPrepare;
  });
});

class FakeBrowserWindow extends EventEmitter {
  webContents = new EventEmitter() as EventEmitter & {
    executeJavaScript: (source: string) => Promise<void>;
    send: (channel: string, payload: unknown) => void;
  };
  loadedURL: string | null = null;
  loadCount = 0;
  showCount = 0;
  focusCount = 0;
  executedJavaScript: string[] = [];
  sentMessages: [string, unknown][] = [];

  constructor() {
    super();
    this.webContents.executeJavaScript = async (source: string) => {
      this.executedJavaScript.push(source);
    };
    this.webContents.send = (channel: string, payload: unknown) => {
      this.sentMessages.push([channel, payload]);
    };
  }

  loadURL(url: string): void {
    this.loadedURL = url;
    this.loadCount += 1;
  }

  show(): void {
    this.showCount += 1;
  }

  focus(): void {
    this.focusCount += 1;
  }
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}
