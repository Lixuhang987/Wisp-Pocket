import type {
  CreateThreadParams,
  RolloutItem,
  ThreadId,
  ThreadStoreResult,
  ResumeThreadParams,
} from "./types/ThreadStore.ts";
import { ThreadStore } from "./ThreadStore.ts";

export class CurrentThread {
  private closed = false;

  private constructor(
    private readonly store: ThreadStore,
    readonly threadId: ThreadId,
  ) {}

  static async create(
    store: ThreadStore,
    params: CreateThreadParams,
  ): Promise<ThreadStoreResult<CurrentThread>> {
    const result = await store.createThread(params);
    if (!result.ok) return result;
    return ok(new CurrentThread(store, params.threadId));
  }

  static async resume(
    store: ThreadStore,
    params: ResumeThreadParams,
  ): Promise<ThreadStoreResult<CurrentThread>> {
    const result = await store.resumeThread(params);
    if (!result.ok) return result;
    return ok(new CurrentThread(store, params.threadId));
  }

  appendItem(item: RolloutItem): Promise<ThreadStoreResult<void>> {
    return this.appendItems([item]);
  }

  async appendItems(items: RolloutItem[]): Promise<ThreadStoreResult<void>> {
    if (this.closed) {
      return {
        ok: false,
        error: {
          code: "thread_closed",
          message: `Thread is closed: ${this.threadId}`,
        },
      };
    }
    return this.store.appendItems({ threadId: this.threadId, items });
  }

  async persist(): Promise<ThreadStoreResult<void>> {
    if (this.closed) {
      return ok(undefined);
    }
    return this.store.persistThread(this.threadId);
  }

  async shutdown(): Promise<ThreadStoreResult<void>> {
    if (this.closed) {
      return ok(undefined);
    }
    const result = await this.store.shutdownThread(this.threadId);
    if (result.ok) {
      this.closed = true;
    }
    return result;
  }

  async discard(): Promise<ThreadStoreResult<void>> {
    if (this.closed) {
      return ok(undefined);
    }
    const result = await this.store.discardThread(this.threadId);
    if (result.ok) {
      this.closed = true;
    }
    return result;
  }
}

function ok<T>(value: T): ThreadStoreResult<T> {
  return { ok: true, value };
}
