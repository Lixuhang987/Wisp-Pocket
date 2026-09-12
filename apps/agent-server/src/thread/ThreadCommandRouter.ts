import type {
  ThreadCommand,
  ThreadStartCommand,
  ThreadResumeCommand,
  ThreadListCommand,
  ThreadDeleteCommand,
  OpSubmitCommand,
  WorkspaceListCommand,
} from "@handagent/core/protocol/types/ThreadCommand.ts";
import type {
  ClientResponse,
  PermissionAnsweredResponse,
  WorkspaceAnsweredResponse,
} from "@handagent/core/protocol/types/ClientResponse.ts";
import type { ThreadNotification } from "@handagent/core/protocol/types/ThreadNotification.ts";
import type { ThreadSummary } from "@handagent/thread-store/index.ts";
import type { WorkspaceRegistry } from "@handagent/core/workspace/types/Workspace.ts";
import type { DynamicToolSpec } from "@handagent/core/protocol/types/DynamicTool.ts";
import { ThreadRegistry } from "@handagent/core/thread/ThreadRegistry.ts";
import { ThreadNotificationPublisher } from "./ThreadNotificationPublisher.ts";

export class ThreadCommandRouter {
  constructor(
    private readonly threads: ThreadRegistry,
    private readonly publisher: ThreadNotificationPublisher,
    private readonly workspaceRegistry?: WorkspaceRegistry,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async receive(command: ThreadCommand, connectionId: string): Promise<void> {
    try {
    switch (command.type) {
      case "thread.start":
        return await this.handleCreateThread(command, connectionId);
      case "thread.resume":
        return await this.handleResumeThread(command, connectionId);
      case "op.submit":
        return await this.handleOpSubmit(command, connectionId);
      case "thread.list":
        return await this.handleListThreads(command, connectionId);
      case "thread.delete":
        return await this.handleDeleteThread(command, connectionId);
      case "workspace.list":
        return await this.handleListWorkspaces(command, connectionId);
    }
      } catch (error) {
      this.publisher.publishToConnection(connectionId, {
        type: "thread.error", notificationId: this.makeNotificationId(), commandId: command.commandId,
        ...("threadId" in command ? { threadId: command.threadId } : {}), timestamp: this.now(),
        payload: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  async handleResponse(response: ClientResponse, connectionId: string): Promise<void> {
    const separator = response.requestId.lastIndexOf(":");
    const threadId = response.requestId.slice(0, separator);
    if (!this.publisher.canAnswer(connectionId, threadId)) return;
    this.threads.get(threadId)?.requests.answer(response);
  }

  async interruptThread(threadId: string): Promise<void> {
    await this.threads.get(threadId)?.interrupt();
  }

  private async handleCreateThread(
    command: ThreadStartCommand,
    connectionId: string,
  ): Promise<void> {
    const thread = await this.threads.create({
      workspaceId: command.payload.workspaceId,
      dynamicTools: command.payload.dynamicTools,
    });
    const threadId = thread.id;
    this.publisher.subscribe(connectionId, threadId);
    this.publisher.publish({
      type: "thread.started",
      threadId,
      notificationId: this.makeNotificationId(),
      commandId: command.commandId,
      timestamp: this.now(),
      payload: { preview: null },
    });
  }

  private async handleResumeThread(
    command: ThreadResumeCommand,
    connectionId: string,
  ): Promise<void> {
    this.publisher.subscribe(connectionId, command.threadId);
    const thread = await this.threads.load(command.threadId);
    this.publisher.publishToConnection(connectionId, {
      type: "thread.snapshot",
      threadId: command.threadId,
      notificationId: this.makeNotificationId(),
      commandId: command.commandId,
      timestamp: this.now(),
      payload: thread.snapshot(),
    });
  }

  private async handleOpSubmit(
    command: OpSubmitCommand,
    connectionId?: string,
  ): Promise<void> {
    const thread = this.threads.get(command.threadId) ?? await this.threads.load(command.threadId);
    await thread.submit(command.payload.op);
  }

  private async handleListThreads(
    command: ThreadListCommand,
    connectionId: string,
  ): Promise<void> {
    const threads = await this.threads.list();
    this.publisher.publishToConnection(connectionId, {
      type: "thread.listed",
      notificationId: this.makeNotificationId(),
      commandId: command.commandId,
      timestamp: this.now(),
      payload: {
        threads: threads.map(toThreadListEntry),
      },
    });
  }

  private async handleDeleteThread(
    command: ThreadDeleteCommand,
    connectionId: string,
  ): Promise<void> {
    const targetThreadId = command.payload.targetThreadId;
    const deleted = await this.threads.delete(targetThreadId);
    this.publisher.publishToConnection(connectionId, {
      type: "thread.deleted", notificationId: this.makeNotificationId(), commandId: command.commandId,
      timestamp: this.now(), payload: { targetThreadId, status: deleted ? "deleted" : "not_found" },
    });
  }

  private async handleListWorkspaces(
    command: WorkspaceListCommand,
    connectionId: string,
  ): Promise<void> {
    if (!this.workspaceRegistry) {
      this.publisher.publishToConnection(connectionId, {
        type: "thread.error",
        notificationId: this.makeNotificationId(),
        commandId: command.commandId,
        timestamp: this.now(),
        payload: {
          code: "workspace_registry_not_configured",
          message: "Workspace registry is not configured",
        },
      });
      return;
    }

    const workspaces = await this.workspaceRegistry.list();
    this.publisher.publishToConnection(connectionId, {
      type: "workspace.listed",
      notificationId: this.makeNotificationId(),
      commandId: command.commandId,
      timestamp: this.now(),
      payload: {
        workspaces: workspaces.map((ws) => ({
          id: ws.id,
          name: ws.name,
          rootPath: ws.rootPath,
        })),
      },
    });
  }

  private makeNotificationId(): string {
    return `notification-${crypto.randomUUID()}`;
  }

}

function toThreadListEntry(summary: ThreadSummary) {
  return {
    id: summary.id,
    preview: summary.preview,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    messageCount: summary.messageCount,
    workspaceId: summary.workspaceId,
  };
}
