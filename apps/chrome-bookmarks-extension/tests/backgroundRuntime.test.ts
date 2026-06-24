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

  it("sends a folder tree snapshot after connecting to the native host", async () => {
    const harness = makeHarness();
    const runtime = new ChromeBookmarksBackgroundRuntime(harness.options);

    await runtime.start();

    expect(harness.port.messages[1]).toEqual({
      type: "handagent.bookmarks.folderTreeSnapshot",
      protocolVersion: 1,
      profileId: "chrome-default",
      folders: [
        {
          id: "1",
          title: "书签栏",
          childCount: 2,
          children: [
            {
              id: "6",
              title: "a",
              childCount: 1,
              children: [],
            },
          ],
        },
        {
          id: "2",
          title: "其他书签",
          childCount: 1,
          children: [],
        },
      ],
      updatedAt: "2026-06-23T00:00:00.000Z",
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

    expect(harness.port.messages[2]).toMatchObject({
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

    expect(harness.port.messages).toHaveLength(2);
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
      async getTree() {
        return [
          {
            id: "0",
            title: "",
            children: [
              {
                id: "1",
                title: "书签栏",
                children: [
                  {
                    id: "5",
                    parentId: "1",
                    title: "OpenAI",
                    url: "https://openai.com",
                  },
                  {
                    id: "6",
                    parentId: "1",
                    title: "a",
                    children: [
                      {
                        id: "7",
                        parentId: "6",
                        title: "PRTS Plus",
                        url: "https://prts.plus/",
                      },
                    ],
                  },
                ],
              },
              {
                id: "2",
                title: "其他书签",
                children: [
                  {
                    id: "8",
                    parentId: "2",
                    title: "Docs",
                    url: "https://example.com/docs",
                  },
                ],
              },
            ],
          },
        ];
      },
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
