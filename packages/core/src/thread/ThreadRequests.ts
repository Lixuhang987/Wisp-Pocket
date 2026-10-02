import { randomUUID } from "node:crypto";
import type { PermissionRequest, PermissionResolution } from "../permission/PermissionPolicy.ts";
import type { ClientResponse } from "../protocol/types/ClientResponse.ts";
import type { ServerRequest } from "../protocol/types/ServerRequest.ts";
import type { PermissionPending } from "./types/ThreadRequests.ts";

export class ThreadRequests {
  private readonly permissions = new Map<string, PermissionPending>();
  private readonly visibleRequests = new Map<string, ServerRequest>();

  constructor(
    private readonly threadId: string,
    private readonly emit: (request: ServerRequest) => void,
    private readonly canAsk: () => boolean,
    private readonly timeoutMs = 60_000,
    private readonly onResolved: (requestId: string) => void = () => {},
  ) {}

  askPermission = (request: PermissionRequest): Promise<PermissionResolution> => {
    if (!this.canAsk()) return Promise.resolve({ decision: "deny" });
    const requestId = `${this.threadId}:${randomUUID()}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.permissions.delete(requestId);
        this.resolved(requestId);
        resolve({ decision: "deny", reason: "permission request timed out" });
      }, this.timeoutMs);
      this.permissions.set(requestId, { resolve, timer });
      this.present({ type: "permission.requested", requestId, threadId: this.threadId,
        timestamp: new Date().toISOString(), payload: {
          toolName: request.toolName, toolCallId: request.toolCallId,
          arguments: request.arguments, timeoutMs: this.timeoutMs,
        } });
    });
  };

  answer(response: ClientResponse): void {
    if (response.type === "permission.answered") {
      const pending = this.permissions.get(response.requestId);
      if (!pending) return;
      if (response.payload.scope && !["once", "always"].includes(response.payload.scope)) return;
      clearTimeout(pending.timer);
      this.permissions.delete(response.requestId);
      this.resolved(response.requestId);
      pending.resolve({ decision: response.payload.decision, remember: response.payload.scope, reason: response.payload.reason });
    }
  }

  cancel(): void {
    for (const [id, pending] of this.permissions) {
      clearTimeout(pending.timer);
      this.resolved(id);
      pending.resolve({ decision: "deny", reason: "thread interrupted" });
    }
    this.permissions.clear();
  }

  snapshot(): ServerRequest[] { return structuredClone([...this.visibleRequests.values()]); }

  private present(request: ServerRequest): void {
    this.visibleRequests.set(request.requestId, request);
    this.emit(request);
  }

  private resolved(requestId: string): void {
    if (this.visibleRequests.delete(requestId)) this.onResolved(requestId);
  }
}
