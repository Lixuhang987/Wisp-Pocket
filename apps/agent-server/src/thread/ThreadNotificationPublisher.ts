import type { ServerRequest } from "@handagent/core/protocol/ServerRequest.ts";
import type { ThreadNotification } from "@handagent/core/protocol/ThreadNotification.ts";

export type PublishedThreadMessage = ThreadNotification | ServerRequest;
type SendEvent = (event: PublishedThreadMessage) => void;

type ConnectionState = {
  send: SendEvent;
  subscriptions: Set<string>;
  subscribeNewThreads: boolean;
};

export class ThreadNotificationPublisher {
  private readonly connections = new Map<string, ConnectionState>();

  constructor(private readonly observer: SendEvent = () => {}) {}

  attachConnection(connectionId: string, send: SendEvent): void {
    this.connections.set(connectionId, {
      send,
      subscriptions: this.connections.get(connectionId)?.subscriptions ?? new Set<string>(),
      subscribeNewThreads: this.connections.get(connectionId)?.subscribeNewThreads ?? false,
    });
  }

  detachConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  subscribe(connectionId: string, threadId: string): void {
    this.connections.get(connectionId)?.subscriptions.add(threadId);
  }

  subscribeNewThreads(connectionId: string): void {
    const state = this.connections.get(connectionId);
    if (state) {
      state.subscribeNewThreads = true;
    }
  }

  unsubscribe(connectionId: string, threadId: string): void {
    this.connections.get(connectionId)?.subscriptions.delete(threadId);
  }

  publish(event: PublishedThreadMessage): void {
    this.observe(event);

    if (hasThreadId(event)) {
      for (const state of this.connections.values()) {
        if (event.type === "thread.started" && state.subscribeNewThreads) {
          state.subscriptions.add(event.threadId);
        }
        if (isServerRequest(event) && !state.subscribeNewThreads) {
          continue;
        }
        if (state.subscriptions.has(event.threadId)) {
          state.send(event);
        }
      }
      return;
    }

    for (const state of this.connections.values()) {
      state.send(event);
    }
  }

  publishToConnection(connectionId: string, event: PublishedThreadMessage): void {
    this.observe(event);
    this.connections.get(connectionId)?.send(event);
  }

  private observe(event: PublishedThreadMessage): void {
    try {
      this.observer(event);
    } catch {
      // Observer side effects must not break thread notification fanout.
    }
  }
}

function hasThreadId(
  event: PublishedThreadMessage,
): event is PublishedThreadMessage & { threadId: string } {
  return "threadId" in event && typeof event.threadId === "string";
}

function isServerRequest(event: PublishedThreadMessage): event is ServerRequest {
  return event.type === "permission.requested" || event.type === "workspace.requested";
}
