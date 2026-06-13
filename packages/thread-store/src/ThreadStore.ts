import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AgentMessage } from "@handagent/core/runtime/AgentMessage.ts";
import type {
  AppendItemsInput,
  CreateThreadParams,
  LoadHistoryInput,
  PersistedThread,
  RolloutItem,
  SessionMeta,
  StoredRolloutItem,
  StoredThreadHistory,
  ThreadAuditEvent,
  ThreadId,
  ThreadMetadata,
  ThreadStoreError,
  ThreadStoreResult,
  ThreadSummary,
  ResumeThreadParams,
} from "./types.ts";

type ThreadStoreOptions = {
  dbPath: string;
  now?: () => string;
};

type LiveThread = {
  meta: SessionMeta;
  preview: string | null;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
  nextSequence: number;
  persisted: boolean;
  pending: Array<{
    sequence: number;
    item: RolloutItem;
    createdAt: string;
  }>;
};

type ThreadRow = {
  thread_id: string;
  preview: string | null;
  created_at: string;
  updated_at: string;
  forked_from_id: string | null;
  parent_thread_id: string | null;
  thread_source: string;
  originator: string;
  agent_path: string | null;
  dynamic_tools_json: string | null;
  workspace_id: string | null;
  closed_at: string | null;
};

type ThreadItemRow = {
  sequence: number;
  kind: RolloutItem["kind"];
  payload_json: string;
  created_at: string;
};

export class ThreadStore {
  private readonly db: DatabaseSync;
  private readonly now: () => string;
  private readonly liveThreads = new Map<ThreadId, LiveThread>();
  private readonly writeQueues = new Map<ThreadId, Promise<void>>();

  constructor(options: ThreadStoreOptions) {
    mkdirSync(dirname(options.dbPath), { recursive: true });
    this.db = new DatabaseSync(options.dbPath);
    this.now = options.now ?? (() => new Date().toISOString());
    this.initialize();
  }

  async createThread(params: CreateThreadParams): Promise<ThreadStoreResult<void>> {
    return this.withThreadQueue(params.threadId, () => {
      if (this.liveThreads.has(params.threadId) || this.threadExists(params.threadId)) {
        return err("thread_exists", `Thread already exists: ${params.threadId}`);
      }

      const timestamp = params.timestamp ?? this.now();
      this.liveThreads.set(params.threadId, {
        meta: {
          id: params.threadId,
          ...(params.forkedFromId ? { forkedFromId: params.forkedFromId } : {}),
          ...(params.parentThreadId ? { parentThreadId: params.parentThreadId } : {}),
          timestamp,
          originator: params.originator ?? "user",
          threadSource: params.threadSource ?? "user",
          ...(params.agentPath ? { agentPath: params.agentPath } : {}),
          ...(params.dynamicTools ? { dynamicTools: params.dynamicTools } : {}),
          workspaceId: params.workspaceId ?? null,
        },
        preview: params.preview ?? null,
        workspaceId: params.workspaceId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        nextSequence: 1,
        persisted: false,
        pending: [],
      });

      return ok(undefined);
    });
  }

  async resumeThread(params: ResumeThreadParams): Promise<ThreadStoreResult<void>> {
    return this.withThreadQueue(params.threadId, () => {
      if (this.liveThreads.has(params.threadId)) {
        return ok(undefined);
      }

      const row = this.getThreadRow(params.threadId);
      if (!row) {
        return err("thread_not_found", `Thread not found: ${params.threadId}`);
      }

      this.liveThreads.set(params.threadId, {
        meta: rowToSessionMeta(row),
        preview: row.preview,
        workspaceId: row.workspace_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        nextSequence: this.nextSequence(params.threadId),
        persisted: true,
        pending: [],
      });
      return ok(undefined);
    });
  }

  async appendItems(input: AppendItemsInput): Promise<ThreadStoreResult<void>> {
    return this.withThreadQueue(input.threadId, () => {
      const live = this.liveThreads.get(input.threadId);
      if (!live) {
        return err("thread_not_open", `Thread is not open: ${input.threadId}`);
      }
      for (const item of input.items) {
        live.pending.push({
          sequence: live.nextSequence,
          item,
          createdAt: this.now(),
        });
        live.nextSequence += 1;
      }
      if (input.items.length > 0) {
        live.updatedAt = this.now();
      }
      return ok(undefined);
    });
  }

  async persistThread(threadId: ThreadId): Promise<ThreadStoreResult<void>> {
    return this.withThreadQueue(threadId, () => {
      const live = this.liveThreads.get(threadId);
      if (!live) {
        return err("thread_not_open", `Thread is not open: ${threadId}`);
      }
      this.transaction(() => {
        if (!live.persisted) {
          this.insertThreadRow(threadId, live);
          this.insertItem(threadId, 0, "session_meta", live.meta, live.createdAt);
          live.nextSequence = Math.max(live.nextSequence, 1);
          live.persisted = true;
        }
        for (const pending of live.pending) {
          this.insertItem(
            threadId,
            pending.sequence,
            pending.item.kind,
            pending.item.payload,
            pending.createdAt,
          );
        }
        live.pending = [];
        live.updatedAt = this.now();
        this.updateThreadRow(threadId, {
          preview: live.preview,
          updatedAt: live.updatedAt,
          workspaceId: live.workspaceId,
          closedAt: null,
        });
      });
      return ok(undefined);
    });
  }

  async shutdownThread(threadId: ThreadId): Promise<ThreadStoreResult<void>> {
    const result = await this.persistThread(threadId);
    if (!result.ok && result.error.code !== "thread_not_open") {
      return result;
    }
    this.liveThreads.delete(threadId);
    return ok(undefined);
  }

  async discardThread(threadId: ThreadId): Promise<ThreadStoreResult<void>> {
    this.liveThreads.delete(threadId);
    return ok(undefined);
  }

  async flushThread(_threadId: ThreadId): Promise<ThreadStoreResult<void>> {
    return err("not_implemented", "flushThread is not implemented");
  }

  async loadHistory(input: LoadHistoryInput): Promise<ThreadStoreResult<StoredThreadHistory>> {
    return this.capture(() => {
      const rows = this.getItemRows(input.threadId);
      const live = this.liveThreads.get(input.threadId);
      if (rows.length === 0 && !live) {
        return err("thread_not_found", `Thread not found: ${input.threadId}`);
      }

      const persistedItems = rows.map(rowToStoredRolloutItem);
      const liveItems = live?.pending.map((pending) => ({
        ...pending.item,
        sequence: pending.sequence,
        createdAt: pending.createdAt,
      })) ?? [];
      return ok({
        threadId: input.threadId,
        rolloutItems: [...persistedItems, ...liveItems].sort(
          (a, b) => a.sequence - b.sequence,
        ),
        persisted: rows.length > 0 || Boolean(live?.persisted),
      });
    });
  }

  async deleteThread(threadId: ThreadId): Promise<ThreadStoreResult<void>> {
    return this.withThreadQueue(threadId, () => {
      this.liveThreads.delete(threadId);
      this.db.prepare("DELETE FROM threads WHERE thread_id = ?").run(threadId);
      return ok(undefined);
    });
  }

  async updatePreview(
    threadId: ThreadId,
    preview: string | null,
    updatedAt = this.now(),
  ): Promise<ThreadStoreResult<void>> {
    return this.withThreadQueue(threadId, () => {
      const live = this.liveThreads.get(threadId);
      if (live) {
        live.preview = preview;
        live.updatedAt = updatedAt;
      }
      if (this.threadExists(threadId)) {
        this.updateThreadRow(threadId, {
          preview,
          updatedAt,
          workspaceId: live?.workspaceId,
          closedAt: undefined,
        });
      }
      if (!live && !this.threadExists(threadId)) {
        return err("thread_not_found", `Thread not found: ${threadId}`);
      }
      return ok(undefined);
    });
  }

  async listThreads(): Promise<ThreadStoreResult<ThreadSummary[]>> {
    return this.capture(() => {
      const rows = this.db
        .prepare("SELECT * FROM threads ORDER BY updated_at DESC")
        .all() as ThreadRow[];
      return ok(rows.map((row) => this.summaryForRow(row)));
    });
  }

  async getPersistedThread(threadId: ThreadId): Promise<ThreadStoreResult<PersistedThread | null>> {
    return this.capture(() => ok(this.derivePersistedThread(threadId)));
  }

  async replaceResponseItems(
    threadId: ThreadId,
    messages: AgentMessage[],
    updatedAt = this.now(),
  ): Promise<ThreadStoreResult<void>> {
    return this.withThreadQueue(threadId, () => {
      if (!this.threadExists(threadId)) {
        return err("thread_not_found", `Thread not found: ${threadId}`);
      }
      this.transaction(() => {
        this.db.prepare("DELETE FROM thread_items WHERE thread_id = ?").run(threadId);
        const row = this.getThreadRow(threadId);
        if (!row) {
          throw new Error(`Thread not found: ${threadId}`);
        }
        this.insertItem(threadId, 0, "session_meta", rowToSessionMeta(row), row.created_at);
        let sequence = 1;
        for (const message of messages) {
          this.insertItem(threadId, sequence, "response_item", message, updatedAt);
          sequence += 1;
        }
        this.updateThreadRow(threadId, {
          preview: row.preview,
          updatedAt,
          workspaceId: row.workspace_id,
          closedAt: row.closed_at,
        });
        const live = this.liveThreads.get(threadId);
        if (live) {
          live.pending = [];
          live.nextSequence = sequence;
          live.updatedAt = updatedAt;
        }
      });
      return ok(undefined);
    });
  }

  close(): void {
    this.db.close();
  }

  private initialize(): void {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS threads (
        thread_id TEXT PRIMARY KEY,
        preview TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        forked_from_id TEXT,
        parent_thread_id TEXT,
        thread_source TEXT NOT NULL,
        originator TEXT NOT NULL,
        agent_path TEXT,
        dynamic_tools_json TEXT,
        workspace_id TEXT,
        closed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS thread_items (
        thread_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        kind TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (thread_id, sequence),
        FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_thread_items_thread_sequence
        ON thread_items(thread_id, sequence);
    `);
  }

  private async withThreadQueue<T>(
    threadId: ThreadId,
    operation: () => ThreadStoreResult<T>,
  ): Promise<ThreadStoreResult<T>> {
    const previous = this.writeQueues.get(threadId) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.catch(() => {}).then(() => current);
    this.writeQueues.set(threadId, queued);

    await previous.catch(() => {});
    try {
      return this.capture(operation);
    } finally {
      release();
      if (this.writeQueues.get(threadId) === queued) {
        this.writeQueues.delete(threadId);
      }
    }
  }

  private capture<T>(operation: () => ThreadStoreResult<T>): ThreadStoreResult<T> {
    try {
      return operation();
    } catch (error) {
      return err("sqlite_error", error instanceof Error ? error.message : String(error), error);
    }
  }

  private transaction(operation: () => void): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      operation();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private threadExists(threadId: ThreadId): boolean {
    return this.getThreadRow(threadId) !== null;
  }

  private getThreadRow(threadId: ThreadId): ThreadRow | null {
    return this.db
      .prepare("SELECT * FROM threads WHERE thread_id = ?")
      .get(threadId) as ThreadRow | undefined ?? null;
  }

  private getItemRows(threadId: ThreadId): ThreadItemRow[] {
    return this.db
      .prepare("SELECT sequence, kind, payload_json, created_at FROM thread_items WHERE thread_id = ? ORDER BY sequence ASC")
      .all(threadId) as ThreadItemRow[];
  }

  private nextSequence(threadId: ThreadId): number {
    const row = this.db
      .prepare("SELECT MAX(sequence) AS max_sequence FROM thread_items WHERE thread_id = ?")
      .get(threadId) as { max_sequence: number | null } | undefined;
    return (row?.max_sequence ?? -1) + 1;
  }

  private insertThreadRow(threadId: ThreadId, live: LiveThread): void {
    this.db.prepare(`
      INSERT INTO threads (
        thread_id,
        preview,
        created_at,
        updated_at,
        forked_from_id,
        parent_thread_id,
        thread_source,
        originator,
        agent_path,
        dynamic_tools_json,
        workspace_id,
        closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      threadId,
      live.preview,
      live.createdAt,
      live.updatedAt,
      live.meta.forkedFromId ?? null,
      live.meta.parentThreadId ?? null,
      live.meta.threadSource,
      live.meta.originator,
      live.meta.agentPath ?? null,
      live.meta.dynamicTools ? JSON.stringify(live.meta.dynamicTools) : null,
      live.workspaceId,
    );
  }

  private updateThreadRow(
    threadId: ThreadId,
    input: {
      preview?: string | null;
      updatedAt: string;
      workspaceId?: string | null;
      closedAt?: string | null;
    },
  ): void {
    this.db.prepare(`
      UPDATE threads
      SET preview = CASE WHEN ? THEN ? ELSE preview END,
          updated_at = ?,
          workspace_id = CASE WHEN ? THEN ? ELSE workspace_id END,
          closed_at = CASE WHEN ? THEN ? ELSE closed_at END
      WHERE thread_id = ?
    `).run(
      Object.hasOwn(input, "preview") ? 1 : 0,
      input.preview ?? null,
      input.updatedAt,
      Object.hasOwn(input, "workspaceId") ? 1 : 0,
      input.workspaceId ?? null,
      Object.hasOwn(input, "closedAt") ? 1 : 0,
      input.closedAt ?? null,
      threadId,
    );
  }

  private insertItem(
    threadId: ThreadId,
    sequence: number,
    kind: RolloutItem["kind"],
    payload: unknown,
    createdAt: string,
  ): void {
    this.db.prepare(`
      INSERT INTO thread_items (thread_id, sequence, kind, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(threadId, sequence, kind, JSON.stringify(payload), createdAt);
  }

  private summaryForRow(row: ThreadRow): ThreadSummary {
    const metadata = this.metadataForRow(row);
    return { ...metadata };
  }

  private metadataForRow(row: ThreadRow): ThreadMetadata {
    return {
      id: row.thread_id,
      preview: row.preview,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: this.messagesForThread(row.thread_id).length,
      workspaceId: row.workspace_id,
    };
  }

  private derivePersistedThread(threadId: ThreadId): PersistedThread | null {
    const row = this.getThreadRow(threadId);
    const live = this.liveThreads.get(threadId);
    if (!row && !live) return null;
    const metadata = row
      ? this.metadataForRow(row)
      : {
          id: threadId,
          preview: live?.preview ?? null,
          createdAt: live?.createdAt ?? this.now(),
          updatedAt: live?.updatedAt ?? this.now(),
          messageCount: this.messagesForThread(threadId).length,
          workspaceId: live?.workspaceId ?? null,
        };

    const messages = this.messagesForThread(threadId);
    metadata.messageCount = messages.length;
    return {
      version: 1,
      metadata,
      messages,
      events: this.auditEventsForThread(threadId),
    };
  }

  private messagesForThread(threadId: ThreadId): AgentMessage[] {
    return this.rolloutItemsForThread(threadId)
      .filter((item): item is StoredRolloutItem & { kind: "response_item" } =>
        item.kind === "response_item"
      )
      .map((item) => item.payload);
  }

  private auditEventsForThread(threadId: ThreadId): ThreadAuditEvent[] {
    const events: ThreadAuditEvent[] = [];
    for (const item of this.rolloutItemsForThread(threadId)) {
      if (item.kind !== "turn_context") continue;
      events.push(...(item.payload.auditEvents ?? []));
    }
    return events;
  }

  private rolloutItemsForThread(threadId: ThreadId): StoredRolloutItem[] {
    const rows = this.getItemRows(threadId).map(rowToStoredRolloutItem);
    const live = this.liveThreads.get(threadId);
    const pending = live?.pending.map((item) => ({
      ...item.item,
      sequence: item.sequence,
      createdAt: item.createdAt,
    })) ?? [];
    return [...rows, ...pending].sort((a, b) => a.sequence - b.sequence);
  }
}

function rowToStoredRolloutItem(row: ThreadItemRow): StoredRolloutItem {
  return {
    kind: row.kind,
    payload: JSON.parse(row.payload_json),
    sequence: row.sequence,
    createdAt: row.created_at,
  } as StoredRolloutItem;
}

function rowToSessionMeta(row: ThreadRow): SessionMeta {
  return {
    id: row.thread_id,
    ...(row.forked_from_id ? { forkedFromId: row.forked_from_id } : {}),
    ...(row.parent_thread_id ? { parentThreadId: row.parent_thread_id } : {}),
    timestamp: row.created_at,
    originator: row.originator,
    threadSource: row.thread_source === "subagent" ? "subagent" : "user",
    ...(row.agent_path ? { agentPath: row.agent_path } : {}),
    ...(row.dynamic_tools_json ? { dynamicTools: JSON.parse(row.dynamic_tools_json) } : {}),
    workspaceId: row.workspace_id,
  };
}

function ok<T>(value: T): ThreadStoreResult<T> {
  return { ok: true, value };
}

function err(
  code: ThreadStoreError["code"],
  message: string,
  cause?: unknown,
): ThreadStoreResult<never> {
  return { ok: false, error: { code, message, ...(cause ? { cause } : {}) } };
}
