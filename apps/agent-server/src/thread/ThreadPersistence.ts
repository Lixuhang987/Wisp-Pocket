import type { AgentMessage } from "@handagent/core/runtime/AgentMessage.ts";
import type { BlobStore } from "@handagent/core/blob/BlobStore.ts";
import { FilesystemBlobStore } from "@handagent/core/blob/FilesystemBlobStore.ts";
import type { UserInput } from "@handagent/core/protocol/Op.ts";
import type { ThreadNotification } from "@handagent/core/protocol/ThreadNotification.ts";
import {
  CurrentThread,
  ThreadStore,
  type PersistedThread,
  type RolloutItem,
  type ThreadAuditEvent,
  type ThreadStoreResult,
  type ThreadSummary,
} from "@handagent/thread-store/index.ts";
import type { CreateThreadParams } from "@handagent/thread-store/index.ts";
import {
  agentMessagesToConversation,
  composeUserContent,
  composeUserInputContent,
  deriveTitle,
} from "../protocol/MessageTranslator.ts";

export class ThreadPersistence {
  private readonly currentThreads = new Map<string, CurrentThread>();

  constructor(
    private readonly store: ThreadStore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly blobStore: BlobStore = new FilesystemBlobStore(),
  ) {}

  async createThread(
    preview?: string,
    workspaceId?: string | null,
  ): Promise<PersistedThread> {
    const id = generateThreadId();
    const current = await this.createCurrentThread({
      threadId: id,
      preview,
      workspaceId,
      timestamp: this.now(),
      threadSource: "user",
      originator: "user",
    });
    this.currentThreads.set(id, current);
    return await this.requireThread(id);
  }

  async deleteThread(threadId: string): Promise<void> {
    this.currentThreads.delete(threadId);
    unwrap(await this.store.deleteThread(threadId));
  }

  async renameThread(threadId: string, preview: string): Promise<void> {
    unwrap(await this.store.updatePreview(threadId, preview, this.now()));
  }

  async listThreads(): Promise<ThreadSummary[]> {
    return unwrap(await this.store.listThreads());
  }

  async getThread(threadId: string): Promise<PersistedThread | null> {
    return unwrap(await this.store.getPersistedThread(threadId));
  }

  async ensureThread(threadId: string): Promise<void> {
    await this.ensureCurrentThread(threadId);
  }

  async persistUserMessage(
    threadId: string,
    text: string,
    attachments?: Parameters<typeof composeUserContent>[1],
  ): Promise<void> {
    const userMessage: AgentMessage = {
      role: "user",
      content: await composeUserContent(text, attachments, this.blobStore),
    };
    await this.appendAndPersist(threadId, [
      { kind: "response_item", payload: userMessage },
    ]);
  }

  async persistUserInput(threadId: string, userInput: UserInput): Promise<void> {
    const userMessage: AgentMessage = {
      role: "user",
      content: await composeUserInputContent(userInput, this.blobStore),
      inputItems: userInput.items.map((item) => ({ ...item })),
    };
    await this.appendAndPersist(threadId, [
      { kind: "response_item", payload: userMessage },
    ]);
  }

  async autoTitle(threadId: string, text: string): Promise<void> {
    const thread = await this.getThread(threadId);
    if (!thread) return;
    if (thread.metadata.preview || thread.messages.length !== 1) return;

    unwrap(await this.store.updatePreview(threadId, deriveTitle(text), this.now()));
  }

  async getMessages(threadId: string): Promise<AgentMessage[]> {
    const Thread = await this.getThread(threadId);
    return Thread?.messages ?? [];
  }

  async getConversationMessages(threadId: string) {
    const messages = await this.getMessages(threadId);
    return agentMessagesToConversation(messages);
  }

  async recoverIncompleteTurnForSnapshot(
    threadId: string,
    timestamp = this.now(),
  ): Promise<"failed" | "interrupted" | null> {
    const thread = await this.getThread(threadId);
    if (!thread || !isIncompleteTurn(thread.messages)) {
      return null;
    }

    const lastError = [...thread.events]
      .reverse()
      .find(
        (event) =>
          event.type === "error" &&
          event.timestamp.localeCompare(thread.metadata.updatedAt) >= 0,
    );
    if (lastError?.code === RUN_INTERRUPTED_CODE) {
      return "interrupted";
    }
    if (lastError) {
      unwrap(await this.store.replaceResponseItems(
        threadId,
        [
          ...thread.messages,
          {
            role: "assistant",
            content: lastError.message,
          },
        ],
        timestamp,
      ));
      return "failed";
    }

    unwrap(await this.store.replaceResponseItems(
      threadId,
      [
        ...thread.messages,
        {
          role: "assistant",
          content: RUN_LOST_AFTER_RESTART_MESSAGE,
        },
      ],
      timestamp,
    ));

    await this.appendAndPersist(threadId, [
      {
        kind: "turn_context",
        payload: {
          turnId: `${threadId}-recovery`,
          status: "failed",
          timestamp,
          auditEvents: [
            {
              type: "error",
              timestamp,
              message: RUN_LOST_AFTER_RESTART_MESSAGE,
              code: RUN_LOST_AFTER_RESTART_CODE,
            },
          ],
        },
      },
    ]);

    return "failed";
  }

  async persistRunResult(
    threadId: string,
    messages: AgentMessage[],
    events: ThreadAuditEvent[],
  ): Promise<void> {
    const history = unwrap(await this.store.loadHistory({ threadId }));
    if (history.persisted) {
      unwrap(await this.store.replaceResponseItems(threadId, messages, this.now()));
      if (events.length > 0) {
        await this.appendAndPersist(threadId, [this.turnContextItem(threadId, events, "completed")]);
      }
      return;
    }

    await this.appendAndPersist(threadId, [
      ...messages.map((message): RolloutItem => ({ kind: "response_item", payload: message })),
      ...(events.length > 0 ? [this.turnContextItem(threadId, events, "completed")] : []),
    ]);
  }

  async persistRunDelta(
    threadId: string,
    baseMessageCount: number,
    runtimeMessages: AgentMessage[],
    events: ThreadAuditEvent[],
    notifications: ThreadNotification[] = [],
  ): Promise<void> {
    const generatedMessages = runtimeMessages.slice(baseMessageCount);
    await this.appendAndPersist(threadId, [
      ...notifications.map((notification): RolloutItem => ({
        kind: "event_msg",
        payload: notification,
      })),
      ...generatedMessages.map((message): RolloutItem => ({
        kind: "response_item",
        payload: message,
      })),
      ...(events.length > 0 ? [this.turnContextItem(threadId, events, "completed")] : []),
    ]);
  }

  async persistNotifications(
    threadId: string,
    notifications: ThreadNotification[],
  ): Promise<void> {
    await this.appendAndPersist(threadId, notifications.map((notification) => ({
      kind: "event_msg",
      payload: notification,
    })));
  }

  async persistError(threadId: string, errorMessage: string, code?: string): Promise<void> {
    const event: ThreadAuditEvent = {
      type: "error",
      timestamp: this.now(),
      message: errorMessage,
      ...(code ? { code } : {}),
    };
    await this.appendAndPersist(threadId, [
      this.turnContextItem(threadId, [event], "failed"),
    ]);
  }

  private async appendAndPersist(threadId: string, items: RolloutItem[]): Promise<void> {
    if (items.length === 0) return;

    const current = await this.ensureCurrentThread(threadId);
    unwrap(await current.appendItems(items));
    unwrap(await current.persist());
  }

  private async ensureCurrentThread(threadId: string): Promise<CurrentThread> {
    const current = this.currentThreads.get(threadId);
    if (current) return current;

    const existing = await this.getThread(threadId);
    if (existing) {
      const resumed = unwrap(await CurrentThread.resume(this.store, { threadId }));
      this.currentThreads.set(threadId, resumed);
      return resumed;
    }

    const created = await this.createCurrentThread({
      threadId,
      timestamp: this.now(),
      threadSource: "user",
      originator: "user",
    });
    this.currentThreads.set(threadId, created);
    return created;
  }

  private async createCurrentThread(params: CreateThreadParams): Promise<CurrentThread> {
    return unwrap(await CurrentThread.create(this.store, params));
  }

  private async requireThread(threadId: string): Promise<PersistedThread> {
    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found after create: ${threadId}`);
    }
    return thread;
  }

  private turnContextItem(
    threadId: string,
    auditEvents: ThreadAuditEvent[],
    status: "completed" | "failed" | "interrupted",
  ): RolloutItem {
    return {
      kind: "turn_context",
      payload: {
        turnId: `${threadId}-${this.now()}`,
        status,
        timestamp: this.now(),
        auditEvents,
      },
    };
  }
}

export const RUN_INTERRUPTED_CODE = "run_interrupted";
export const RUN_INTERRUPTED_MESSAGE = "本轮运行已中断。";
export const RUN_LOST_AFTER_RESTART_CODE = "run_lost_after_restart";
export const RUN_LOST_AFTER_RESTART_MESSAGE = "本轮运行因 agent-server 重启而中断，请重新发送请求。";

function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isIncompleteTurn(messages: AgentMessage[]): boolean {
  return messages.at(-1)?.role === "user";
}

function unwrap<T>(result: ThreadStoreResult<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}
