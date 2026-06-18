import type { AgentTriggerAttention } from "@handagent/core/protocol/AgentTriggerAttention.ts";
import type { AgentTriggerNotificationMode } from "@handagent/core/protocol/AgentTrigger.ts";
import type { ServerRequest } from "@handagent/core/protocol/ServerRequest.ts";
import type { ThreadNotification } from "@handagent/core/protocol/ThreadNotification.ts";

type TriggerState = {
  triggerInstanceId: string;
  notificationMode: AgentTriggerNotificationMode;
  completed: boolean;
};

type SendAttention = (event: AgentTriggerAttention) => void;

export class AgentTriggerAttentionPublisher {
  private readonly connections = new Map<string, SendAttention>();
  private readonly triggerStateByThreadId = new Map<string, TriggerState>();

  registerTriggerThread(
    threadId: string,
    triggerInstanceId: string,
    notificationMode: AgentTriggerNotificationMode,
  ): void {
    this.triggerStateByThreadId.set(threadId, {
      triggerInstanceId,
      notificationMode,
      completed: false,
    });
  }

  attachConnection(connectionId: string, send: SendAttention): void {
    this.connections.set(connectionId, send);
  }

  detachConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  observe(event: ThreadNotification | ServerRequest): void {
    if (!("threadId" in event) || typeof event.threadId !== "string") {
      return;
    }

    const state = this.triggerStateByThreadId.get(event.threadId);
    if (!state || state.completed) {
      return;
    }

    const attention = deriveAttention(event, state);
    if (!attention) {
      return;
    }

    this.broadcast(attention);

    if (event.type === "turn.completed" || event.type === "thread.status.changed" || event.type === "thread.error") {
      state.completed = true;
      this.triggerStateByThreadId.set(event.threadId, state);
    }
  }

  private broadcast(event: AgentTriggerAttention): void {
    for (const send of this.connections.values()) {
      try {
        send(event);
      } catch {
        // Attention fanout must stay isolated from subscriber failures.
      }
    }
  }
}

function deriveAttention(
  event: ThreadNotification | ServerRequest,
  state: TriggerState,
): AgentTriggerAttention | null {
  switch (event.type) {
    case "permission.requested":
      if (state.notificationMode === "silent") {
        return null;
      }
      return {
        threadId: event.threadId,
        triggerInstanceId: state.triggerInstanceId,
        reason: "permission",
        message: "后台 Agent 需要权限确认",
      };
    case "workspace.requested":
      if (state.notificationMode === "silent") {
        return null;
      }
      return {
        threadId: event.threadId,
        triggerInstanceId: state.triggerInstanceId,
        reason: "workspace",
        message: "后台 Agent 需要选择工作区",
      };
    case "turn.completed":
      if (event.payload.status !== "failed" || state.notificationMode === "silent") {
        return null;
      }
      return {
        threadId: event.threadId,
        triggerInstanceId: state.triggerInstanceId,
        reason: "failure",
        message: "后台 Agent 运行失败",
      };
    case "thread.status.changed":
      if (event.payload.value !== "failed" || state.notificationMode === "silent") {
        return null;
      }
      return {
        threadId: event.threadId,
        triggerInstanceId: state.triggerInstanceId,
        reason: "failure",
        message: "后台 Agent 运行失败",
      };
    case "thread.error":
      if (state.notificationMode === "silent") {
        return null;
      }
      return {
        threadId: event.threadId,
        triggerInstanceId: state.triggerInstanceId,
        reason: "failure",
        message: event.payload.message,
      };
    default:
      return null;
  }
}
