import { Thread } from "./Thread.ts";
import type { CreateThreadInput, ThreadServices } from "./types/ThreadServices.ts";
import { settleWithin } from "./utils/settleWithin.ts";

export class ThreadNotFoundError extends Error {
  readonly code = "not_found";
  constructor(id: string) { super(`Thread not found: ${id}`); }
}

export class ThreadRegistry {
  private readonly loaded = new Map<string, Thread>();
  private readonly loading = new Map<string, Promise<Thread>>();
  private readonly deleting = new Map<string, Promise<boolean>>();
  private stopped = false;

  constructor(private readonly services: ThreadServices) {}
  get(id: string): Thread | undefined { return this.loaded.get(id); }
  list() { return this.services.storage.listThreads(); }

  async create(input: CreateThreadInput): Promise<Thread> {
    this.requireOpen();
    const data = await this.services.storage.createThread(input);
    this.requireOpen();
    const existing = this.loaded.get(data.metadata.id);
    if (existing) return existing;
    const thread = new Thread(data.metadata.id, this.services, data);
    this.loaded.set(thread.id, thread);
    return thread;
  }

  load(id: string): Promise<Thread> {
    this.requireOpen();
    if (this.deleting.has(id)) return Promise.reject(new Error(`Thread deleting: ${id}`));
    const pending = this.loading.get(id);
    if (pending) return pending;
    const existing = this.loaded.get(id);
    if (existing && !existing.needsRecovery) return Promise.resolve(existing);
    const task = (async () => {
      if (existing) { await existing.recover(); return existing; }
      const data = await this.services.storage.getThread(id);
      if (!data) throw new ThreadNotFoundError(id);
      await this.services.storage.resetThread(id);
      const status = await this.services.storage.recoverIncompleteTurnForSnapshot(id);
      const recovered = await this.services.storage.getThread(id);
      this.requireOpen();
      const thread = new Thread(id, this.services, recovered!, status ?? "idle");
      this.loaded.set(id, thread);
      return thread;
    })().finally(() => this.loading.delete(id));
    this.loading.set(id, task);
    return task;
  }

  delete(id: string): Promise<boolean> {
    this.requireOpen();
    const pending = this.deleting.get(id);
    if (pending) return pending;
    // Fence input before the first await, including when a load is still in flight.
    const closed = this.loaded.get(id)?.close();
    const task = (async () => {
      const loading = this.loading.get(id);
      if (loading) { const thread = await loading; await thread.close(); }
      await closed;
      const exists = await this.services.storage.getThread(id);
      if (!exists) return false;
      await this.services.storage.deleteThread(id);
      this.loaded.delete(id);
      return true;
    })().finally(() => this.deleting.delete(id));
    this.deleting.set(id, task);
    return task;
  }

  async close(): Promise<void> {
    this.stopped = true;
    const cleanup = Promise.allSettled([...this.loaded.values()].map((thread) => thread.close()));
    await settleWithin(cleanup, this.services.stopTimeoutMs ?? 3000);
    this.loaded.clear();
  }

  private requireOpen(): void { if (this.stopped) throw new Error("Backend is shutting down"); }
}
