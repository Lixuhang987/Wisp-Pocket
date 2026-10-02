import type { ServerRequest } from "@handagent/core/protocol/types/ServerRequest.ts";
import type { ThreadNotification } from "@handagent/core/protocol/types/ThreadNotification.ts";

export type PublishedThreadMessage = ThreadNotification | ServerRequest;
type SendEvent = (event: PublishedThreadMessage) => void;

type ConnectionState = {
  send: SendEvent;
  subscriptions: Set<string>;
  acceptServerRequests: boolean;
  observeRequests: boolean;
};

export class ThreadNotificationPublisher {
  private readonly connections = new Map<string, ConnectionState>();

  constructor(private readonly observer: SendEvent = () => {}) {}

  attachConnection(connectionId: string, send: SendEvent): void {
    this.connections.set(connectionId, {
      send,
      subscriptions: this.connections.get(connectionId)?.subscriptions ?? new Set<string>(),
      acceptServerRequests: this.connections.get(connectionId)?.acceptServerRequests ?? false,
      observeRequests: this.connections.get(connectionId)?.observeRequests ?? false,
    });
  }

  detachConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  subscribe(connectionId: string, threadId: string): void {
    this.connections.get(connectionId)?.subscriptions.add(threadId);
  }

  acceptServerRequests(connectionId: string): void {
    const state = this.connections.get(connectionId);
    if (state) {
      state.acceptServerRequests = true;
    }
  }

  observeRequests(connectionId: string): void {
    const state = this.connections.get(connectionId);
    if (state) state.observeRequests = true;
  }

  isRequestObserver(connectionId: string): boolean {
    return this.connections.get(connectionId)?.observeRequests ?? false;
  }

  canAnswer(connectionId: string, threadId: string): boolean {
    const state = this.connections.get(connectionId);
    return !!state?.acceptServerRequests && !state.observeRequests && state.subscriptions.has(threadId);
  }

  unsubscribe(connectionId: string, threadId: string): void {
    this.connections.get(connectionId)?.subscriptions.delete(threadId);
  }

  publish(event: PublishedThreadMessage): void {
    this.observe(event);

    if (hasThreadId(event)) {
      for (const state of this.connections.values()) {
        if (state.observeRequests) {
          if (event.type === "thread.started" || isServerRequest(event)) {
            try { state.send(event); } catch { /* Isolate disconnected request observers. */ }
          }
          continue;
        }
        if (event.type === "thread.started") {
          state.subscriptions.add(event.threadId);
        }
        if (isServerRequest(event) && !state.acceptServerRequests) {
          continue;
        }
        if (state.subscriptions.has(event.threadId)) {
          try { state.send(event); } catch { /* Disconnected transport cannot fail a Thread. */ }
        }
      }
      return;
    }

    for (const state of this.connections.values()) {
      try { state.send(event); } catch { /* Disconnected transport cannot fail a Thread. */ }
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
  return event.type === "permission.requested";
}
