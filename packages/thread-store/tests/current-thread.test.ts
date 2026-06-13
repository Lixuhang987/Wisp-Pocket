import { afterEach, describe, expect, it } from "vitest";
import { CurrentThread } from "../src/CurrentThread.ts";
import { ThreadStore } from "../src/ThreadStore.ts";
import {
  cleanupTempRoot,
  fixedNow,
  messageTexts,
  tempSqlitePath,
  unwrap,
} from "./helpers.ts";

describe("CurrentThread", () => {
  let tempRoot: string | null = null;

  afterEach(async () => {
    if (tempRoot) {
      await cleanupTempRoot(tempRoot);
      tempRoot = null;
    }
  });

  it("serializes appendItem calls through the underlying store", async () => {
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
});
