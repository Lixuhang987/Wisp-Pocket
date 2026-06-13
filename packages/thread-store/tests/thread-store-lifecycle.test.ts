import { afterEach, describe, expect, it } from "vitest";
import { ThreadStore } from "../src/ThreadStore.ts";
import {
  cleanupTempRoot,
  fixedNow,
  tempSqlitePath,
  unwrap,
} from "./helpers.ts";

describe("ThreadStore lifecycle", () => {
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
