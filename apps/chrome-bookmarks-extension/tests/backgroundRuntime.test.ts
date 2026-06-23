import { describe, expect, it } from "vitest";
import { ChromeBookmarksBackgroundRuntime, nativeHostName, type ChromeBookmarksNativeMessage, type ChromeBookmarksRuntimeChrome } from "../src/backgroundRuntime.js";

describe("ChromeBookmarksBackgroundRuntime", () => {
  it("sends hello after connecting to the native host", async () => {
    const harness = makeHarness();
    const runtime = new ChromeBookmarksBackgroundRuntime(harness.options);

    await runtime.start();

    expect(harness.connectedHostNames).toEqual([nativeHostName]);
    expect(harness.port.messages[0]).toMatchObject({
      type: "handagent.bookmarks.hello",
      protocolVersion: 1,
      extensionVersion: "0.1.0",
      extensionInstanceId: "uuid-1",
      profileId: "chrome-default",
    });
  });

  it("forwards URL bookmark creation through the native port", async () => {
    const harness = makeHarness();
    const runtime = new ChromeBookmarksBackgroundRuntime(harness.options);
    await runtime.start();

    harness.emitBookmarkCreated("bookmark-1", {
      id: "bookmark-1",
      parentId: "folder-a",
      title: "OpenAI",
      url: "https://openai.com",
    });

    expect(harness.port.messages[1]).toMatchObject({
      type: "handagent.bookmarks.created",
      protocolVersion: 1,
      bookmarkId: "bookmark-1",
      parentId: "folder-a",
      title: "OpenAI",
      url: "https://openai.com",
      profileId: "chrome-default",
    });
  });

  it("does not forward bookmark folders", async () => {
    const harness = makeHarness();
    const runtime = new ChromeBookmarksBackgroundRuntime(harness.options);
    await runtime.start();

    harness.emitBookmarkCreated("folder-1", {
      id: "folder-1",
      parentId: "bar",
      title: "Reading",
    });

    expect(harness.port.messages).toHaveLength(1);
  });

  it("schedules reconnect after native port disconnects", async () => {
    const harness = makeHarness();
    const runtime = new ChromeBookmarksBackgroundRuntime(harness.options);
    await runtime.start();

    harness.port.disconnect();
    harness.runScheduledTimeouts();

    expect(harness.connectedHostNames).toEqual([nativeHostName, nativeHostName]);
  });
});

function makeHarness() {
  let bookmarkCreatedListener: ((id: string, bookmark: { id: string; parentId?: string; title?: string; url?: string }) => void) | null = null;
  const storage = new Map<string, unknown>();
  const port = new FakeNativePort();
  const scheduledTimeouts: Array<() => void> = [];
  const connectedHostNames: string[] = [];
  let uuidCounter = 0;

  const chrome: ChromeBookmarksRuntimeChrome = {
    bookmarks: {
      onCreated: {
        addListener(listener) {
          bookmarkCreatedListener = listener;
        },
      },
    },
    runtime: {
      connectNative(hostName) {
        connectedHostNames.push(hostName);
        return port;
      },
      getManifest() {
        return { version: "0.1.0" };
      },
    },
    storage: {
      local: {
        async get(keys) {
          const result: Record<string, unknown> = {};
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            result[key] = storage.get(key);
          }
          return result;
        },
        async set(items) {
          for (const [key, value] of Object.entries(items)) {
            storage.set(key, value);
          }
        },
      },
    },
  };

  return {
    connectedHostNames,
    port,
    options: {
      chrome,
      now: () => "2026-06-23T00:00:00.000Z",
      randomUUID: () => `uuid-${++uuidCounter}`,
      setTimeout: (callback: () => void) => {
        scheduledTimeouts.push(callback);
        return undefined;
      },
    },
    emitBookmarkCreated(id: string, bookmark: { id: string; parentId?: string; title?: string; url?: string }) {
      bookmarkCreatedListener?.(id, bookmark);
    },
    runScheduledTimeouts() {
      for (const callback of scheduledTimeouts.splice(0)) {
        callback();
      }
    },
  };
}

class FakeNativePort {
  readonly messages: ChromeBookmarksNativeMessage[] = [];
  private disconnectListener: (() => void) | null = null;

  readonly onDisconnect = {
    addListener: (listener: () => void) => {
      this.disconnectListener = listener;
    },
  };

  postMessage(message: ChromeBookmarksNativeMessage): void {
    this.messages.push(message);
  }

  disconnect(): void {
    this.disconnectListener?.();
  }
}
