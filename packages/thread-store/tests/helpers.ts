import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "vitest";
import type { AgentMessage } from "@handagent/core/runtime/AgentMessage.ts";
import { ThreadStore } from "../src/ThreadStore.ts";
import type { ThreadStoreResult } from "../src/types.ts";

export const fixedNow = () => "2026-06-14T00:00:00.000Z";

export async function tempSqlitePath(): Promise<{ root: string; dbPath: string }> {
  const root = await mkdtemp(join(tmpdir(), "handagent-thread-store-"));
  return { root, dbPath: join(root, "threads.sqlite") };
}

export async function cleanupTempRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

export function expectOk<T>(result: Promise<ThreadStoreResult<T>> | ThreadStoreResult<T>) {
  return expect(result).resolves
    ? expect(result).resolves.toMatchObject({ ok: true })
    : expect(result).toMatchObject({ ok: true });
}

export async function unwrap<T>(
  result: Promise<ThreadStoreResult<T>> | ThreadStoreResult<T>,
): Promise<T> {
  const resolved = await result;
  if (!resolved.ok) {
    throw new Error(`Expected ok result, got ${resolved.error.code}: ${resolved.error.message}`);
  }
  return resolved.value;
}

export async function materializedStoreWithSession(threadId: string): Promise<{
  root: string;
  store: ThreadStore;
}> {
  const { root, dbPath } = await tempSqlitePath();
  const store = new ThreadStore({ dbPath, now: fixedNow });
  await unwrap(store.createThread({ threadId, threadSource: "user" }));
  await unwrap(store.persistThread(threadId));
  await unwrap(store.discardThread(threadId));
  return { root, store };
}

export async function messageTexts(store: ThreadStore, threadId: string): Promise<string[]> {
  const history = await unwrap(store.loadHistory({ threadId }));
  return history.rolloutItems
    .filter((item) => item.kind === "response_item")
    .map((item) => (item.payload as AgentMessage).content)
    .filter((content): content is string => typeof content === "string");
}
