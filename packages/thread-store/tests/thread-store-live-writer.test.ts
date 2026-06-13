import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupTempRoot,
  materializedStoreWithSession,
  messageTexts,
  unwrap,
} from "./helpers.ts";

describe("ThreadStore live writer", () => {
  let tempRoot: string | null = null;

  afterEach(async () => {
    if (tempRoot) {
      await cleanupTempRoot(tempRoot);
      tempRoot = null;
    }
  });

  it("shutdown persists pending items while discard drops pending items", async () => {
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
});
