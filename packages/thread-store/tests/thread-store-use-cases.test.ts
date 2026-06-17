import { afterEach, describe, expect, it } from "vitest";
import { CurrentThread } from "../src/CurrentThread.ts";
import { ThreadStore } from "../src/ThreadStore.ts";
import {
  cleanupTempRoot,
  fixedNow,
  materializedStoreWithSession,
  messageTexts,
  tempSqlitePath,
  unwrap,
} from "./helpers.ts";

describe("ThreadStore use cases", () => {
  let tempRoot: string | null = null;

  afterEach(async () => {
    if (tempRoot) {
      await cleanupTempRoot(tempRoot);
      tempRoot = null;
    }
  });

  it("create opens a live thread without materializing sqlite rows until persist", async () => {
    const { root, dbPath } = await tempSqlitePath();
    tempRoot = root;
    const store = new ThreadStore({ dbPath, now: fixedNow });

    await unwrap(store.createThread({
      threadId: "thread-1",
      forkedFromId: null,
      parentThreadId: null,
      threadSource: "user",
      dynamicTools: [],
    }));

    expect(await unwrap(store.loadHistory({ threadId: "thread-1" }))).toEqual({
      threadId: "thread-1",
      rolloutItems: [],
      persisted: false,
    });
    expect(await unwrap(store.listThreads())).toEqual([]);

    await unwrap(store.appendItems({
      threadId: "thread-1",
      items: [
        { kind: "response_item", payload: { role: "user", content: "hi" } },
        {
          kind: "event_msg",
          payload: threadStatusChanged("thread-1", "idle"),
        },
      ],
    }));
    await unwrap(store.persistThread("thread-1"));

    const history = await unwrap(store.loadHistory({ threadId: "thread-1" }));
    expect(history.rolloutItems.map((item) => item.kind)).toEqual([
      "session_meta",
      "response_item",
      "event_msg",
    ]);
    expect(history.rolloutItems[0].payload).toMatchObject({
      id: "thread-1",
      threadSource: "user",
    });
    expect(await unwrap(store.listThreads())).toEqual([
      expect.objectContaining({ id: "thread-1", messageCount: 1 }),
    ]);
    await unwrap(store.updatePreview("thread-1", "preview"));
    expect((await unwrap(store.getPersistedThread("thread-1")))?.metadata.preview).toBe(
      "preview",
    );
    await unwrap(store.updatePreview("thread-1", null));
    expect((await unwrap(store.getPersistedThread("thread-1")))?.metadata.preview).toBeNull();

    store.close();
  });

  it("serializes current thread append calls through the underlying SQLite store", async () => {
    const { root, dbPath } = await tempSqlitePath();
    tempRoot = root;
    const store = new ThreadStore({ dbPath, now: fixedNow });
    const current = await unwrap(CurrentThread.create(store, {
      threadId: "thread-1",
      threadSource: "user",
    }));

    await Promise.all([
      current.appendItem({ kind: "response_item", payload: { role: "user", content: "one" } }),
      current.appendItem({ kind: "response_item", payload: { role: "assistant", content: "two" } }),
    ]);
    await unwrap(current.shutdown());
    await unwrap(current.shutdown());

    expect(await messageTexts(store, "thread-1")).toEqual(["one", "two"]);
    store.close();
  });

  it("persists pending live-writer items on shutdown and drops them on discard", async () => {
    const created = await materializedStoreWithSession("thread-1");
    tempRoot = created.root;
    const { store } = created;

    await unwrap(store.resumeThread({ threadId: "thread-1" }));
    await unwrap(store.appendItems({
      threadId: "thread-1",
      items: [{ kind: "response_item", payload: { role: "assistant", content: "saved" } }],
    }));
    await unwrap(store.shutdownThread("thread-1"));
    expect(await messageTexts(store, "thread-1")).toContain("saved");

    await unwrap(store.resumeThread({ threadId: "thread-1" }));
    await unwrap(store.appendItems({
      threadId: "thread-1",
      items: [{ kind: "response_item", payload: { role: "assistant", content: "dropped" } }],
    }));
    await unwrap(store.discardThread("thread-1"));
    expect(await messageTexts(store, "thread-1")).not.toContain("dropped");

    await expect(store.resumeThread({ threadId: "missing" })).resolves.toMatchObject({
      ok: false,
      error: { code: "thread_not_found" },
    });
    await expect(store.flushThread("thread-1")).resolves.toMatchObject({
      ok: false,
      error: { code: "not_implemented" },
    });

    store.close();
  });

  it("keeps the package export surface available to app-server", async () => {
    const mod = await import("../src/index.ts");

    expect(mod.ThreadStore).toBeTypeOf("function");
    expect(mod.CurrentThread).toBeTypeOf("function");
  });
});

function threadStatusChanged(threadId: string, value: "idle" | "running") {
  return {
    type: "thread.status.changed" as const,
    threadId,
    notificationId: "notification-1",
    timestamp: fixedNow(),
    payload: { value },
  };
}
