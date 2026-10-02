import { PetError, type Pet, type PetCreateInput, type PetPatch, type PetImageRef } from "@handagent/core/pet/Pet.ts";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
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
} from "./types/ThreadStore.ts";

type ThreadStoreOptions = {
  dbPath: string;
  now?: () => string;
};

type LiveThread = {
  meta: SessionMeta;
  preview: string | null;
  petId: string;
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
  pet_id: string;
  pet_snapshot_json: string;
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
      if (this.db.prepare("SELECT 1 FROM deleted_threads WHERE thread_id = ?").get(params.threadId)) {
        return err("thread_not_found", `Thread was deleted: ${params.threadId}`);
      }
      if (this.liveThreads.has(params.threadId) || this.threadExists(params.threadId)) {
        return err("thread_exists", `Thread already exists: ${params.threadId}`);
      }

      const pet = this.getPet(params.petId);
      if (!pet) throw new PetError("not_found", `Pet not found: ${params.petId}`);
      const petSnapshot = {petId:pet.id, revision:pet.revision, name:pet.name, rolePrompt:pet.rolePrompt};
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
          petId: params.petId,
          petSnapshot,
        },
        preview: params.preview ?? null,
        petId: params.petId,
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
        petId: row.pet_id,
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
        live.updatedAt = this.now();
        this.updateThreadRow(threadId, {
          preview: live.preview,
          updatedAt: live.updatedAt,
          petId: live.petId,
          closedAt: null,
        });
      });
      live.persisted = true;
      live.pending = [];
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
      this.transaction(() => {
        // Keep the stable creation identity after deleting its history. A lost ACK
        // must never turn a retry into a new Thread or a repeated first turn.
        this.db.prepare(`INSERT OR IGNORE INTO deleted_threads(thread_id)
          SELECT thread_id FROM threads WHERE thread_id = ?`).run(threadId);
        this.db.prepare("DELETE FROM threads WHERE thread_id = ?").run(threadId);
      });
      this.liveThreads.delete(threadId);
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
          petId: live?.petId,
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
        .prepare("SELECT * FROM threads ORDER BY updated_at DESC, thread_id DESC")
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
          petId: row.pet_id,
          closedAt: row.closed_at,
        });
        const live = this.liveThreads.get(threadId);
        if (live) {
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

  listPets(): Pet[] { return (this.db.prepare('SELECT data_json FROM pets ORDER BY created_at, id').all() as {data_json:string}[]).map(row => JSON.parse(row.data_json)); }
  getPet(id: string): Pet | null { const row = this.db.prepare('SELECT data_json FROM pets WHERE id = ?').get(id) as {data_json:string}|undefined; return row ? JSON.parse(row.data_json) : null; }
  createPet(input: PetCreateInput, commandId?: string): Pet {
    let result!: Pet;
    this.transaction(() => {
      const prior = commandId ? this.db.prepare('SELECT pet_id FROM pet_commands WHERE command_id = ?').get(commandId) as {pet_id:string}|undefined : undefined;
      if (prior) { result = this.getPet(prior.pet_id)!; return; }
      const now = this.now();
      result = {...input, description:input.description ?? '',id:crypto.randomUUID(),revision:1,isDefault:input.isDefault === true || this.listPets().length === 0,createdAt:now,updatedAt:now};
      if (result.isDefault) this.clearDefault();
      this.db.prepare('INSERT INTO pets(id,created_at,data_json) VALUES(?,?,?)').run(result.id,now,JSON.stringify(result));
      if (commandId) this.db.prepare('INSERT INTO pet_commands(command_id,pet_id) VALUES(?,?)').run(commandId,result.id);
    });
    return result;
  }
  updatePet(id: string, expectedRevision: number, patch: PetPatch): Pet {
    let result!: Pet;
    this.transaction(() => {
      const prior = this.getPet(id);
      if (!prior) throw new PetError('not_found', `Pet not found: ${id}`);
      if (prior.revision !== expectedRevision) throw new PetError('conflict','桌宠已被其他窗口编辑',prior.revision);
      if (prior.isDefault && patch.isDefault === false) throw new PetError('invalid_input','请将另一只桌宠设为默认');
      if (patch.isDefault === true) this.clearDefault();
      result = {...prior,...patch,revision:prior.revision+1,updatedAt:this.now()};
      this.db.prepare('UPDATE pets SET data_json=? WHERE id=?').run(JSON.stringify(result),id);
    });
    return result;
  }
  private clearDefault(): void {
    for (const pet of this.listPets()) if (pet.isDefault) this.db.prepare('UPDATE pets SET data_json=? WHERE id=?').run(JSON.stringify({...pet,isDefault:false,revision:pet.revision+1,updatedAt:this.now()}),pet.id);
  }
  savePetImage(image: Extract<PetImageRef,{type:'imported'}>): void { this.db.prepare('INSERT OR REPLACE INTO pet_images(blob_id,data_json) VALUES(?,?)').run(image.blobId,JSON.stringify(image)); }
  getPetImage(blobId:string): Extract<PetImageRef,{type:'imported'}>|null { const row=this.db.prepare('SELECT data_json FROM pet_images WHERE blob_id=?').get(blobId) as {data_json:string}|undefined; return row ? JSON.parse(row.data_json) : null; }

  private initialize(): void {
    const columns = this.db.prepare('PRAGMA table_info(threads)').all() as {name:string}[];
    if (columns.length && !columns.some(column => column.name === 'pet_snapshot_json')) {
      this.db.close();
      throw new Error('旧开发数据库不支持 Pet 模型。请备份 ~/.spotAgent/threads.sqlite 后使用新的数据文件重新启动；不会自动迁移或删除旧数据。');
    }
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS pets (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, data_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pet_commands (command_id TEXT PRIMARY KEY, pet_id TEXT NOT NULL REFERENCES pets(id));
      CREATE TABLE IF NOT EXISTS pet_images (blob_id TEXT PRIMARY KEY, data_json TEXT NOT NULL);
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
        pet_id TEXT NOT NULL REFERENCES pets(id),
        pet_snapshot_json TEXT NOT NULL,
        closed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS deleted_threads (thread_id TEXT PRIMARY KEY);
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
        pet_id,
        pet_snapshot_json,
        closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
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
      live.petId,
      JSON.stringify(live.meta.petSnapshot),
    );
  }

  private updateThreadRow(
    threadId: ThreadId,
    input: {
      preview?: string | null;
      updatedAt: string;
      petId?: string | null;
      closedAt?: string | null;
    },
  ): void {
    this.db.prepare(`
      UPDATE threads
      SET preview = CASE WHEN ? THEN ? ELSE preview END,
          updated_at = ?,
          pet_id = CASE WHEN ? THEN ? ELSE pet_id END,
          closed_at = CASE WHEN ? THEN ? ELSE closed_at END
      WHERE thread_id = ?
    `).run(
      Object.hasOwn(input, "preview") ? 1 : 0,
      input.preview ?? null,
      input.updatedAt,
      Object.hasOwn(input, "petId") ? 1 : 0,
      input.petId ?? null,
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
    const events = this.rolloutItemsForThread(row.thread_id).filter(item => item.kind === "event_msg");
    const running = new Set<string>();
    let status: import("@handagent/core/protocol/types/ThreadProtocolShared.ts").RunStatus = "idle";
    for (const event of events) {
      if (event.kind !== "event_msg") continue;
      if (event.payload.type === "turn.started") running.add(event.payload.turnId);
      if (event.payload.type === "turn.completed") { running.delete(event.payload.turnId); status = event.payload.payload.status === "completed" ? "idle" : event.payload.payload.status; }
    }
    return { ...metadata, status: running.size ? "failed" : status };
  }

  private metadataForRow(row: ThreadRow): ThreadMetadata {
    return {
      id: row.thread_id,
      preview: row.preview,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: this.messagesForThread(row.thread_id).length,
      petId: row.pet_id,
      petSnapshot: JSON.parse(row.pet_snapshot_json),
      rootPath: this.getPet(row.pet_id)!.rootPath,
      ...(row.dynamic_tools_json
        ? { dynamicTools: JSON.parse(row.dynamic_tools_json) }
        : {}),
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
          petId: live!.petId,
          petSnapshot: live!.meta.petSnapshot!,
          rootPath: this.getPet(live!.petId)!.rootPath,
          ...(live?.meta.dynamicTools ? { dynamicTools: live.meta.dynamicTools } : {}),
        };

    const messages = this.messagesForThread(threadId);
    const started = new Set(this.rolloutItemsForThread(threadId).flatMap((item) =>
      item.kind === "event_msg" && item.payload.type === "turn.started" ? [item.payload.turnId] : []));
    const pendingInputs = messages.flatMap((message) => message.role === "user" && message.id && message.inputItems && !started.has(message.id)
      ? [{ opId: message.id, payload: { items: message.inputItems,  } }]
      : []);
    metadata.messageCount = messages.length;
    return {
      version: 1,
      metadata,
      messages,
      events: this.auditEventsForThread(threadId),
      ...(pendingInputs.length ? { pendingInputs } : {}),
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
    petId: row.pet_id,
    petSnapshot: JSON.parse(row.pet_snapshot_json),
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
