import { randomUUID } from "node:crypto";
import type { PermissionRequest, PermissionResolution } from "../permission/PermissionPolicy.ts";
import type { WorkspaceAskResolver, WorkspaceAskUserResult } from "../tools/builtins/WorkspaceAskUserTool.ts";
import type { ClientResponse } from "../protocol/types/ClientResponse.ts";
import type { ServerRequest } from "../protocol/types/ServerRequest.ts";
import type { PermissionPending, WorkspacePending } from "./types/ThreadRequests.ts";

export class ThreadRequests {
  private readonly permissions = new Map<string, PermissionPending>();
  private readonly workspaces: WorkspacePending[] = [];
  private activeWorkspace?: WorkspacePending;
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

  askWorkspace: WorkspaceAskResolver = (request) => {
    if (!this.canAsk()) return Promise.resolve({ cancelled: true });
    return new Promise((resolve) => {
      this.workspaces.push({ request, resolve, id: `${this.threadId}:${randomUUID()}` });
      this.dispatchWorkspace();
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
    } else if (this.activeWorkspace?.id === response.requestId) {
      const id = response.payload.workspaceId;
      if (!response.payload.cancelled && id && !this.activeWorkspace.request.candidates.some((item) => item.id === id)) return;
      this.finishWorkspace(response.payload.cancelled || !id ? { cancelled: true } : { workspaceId: id });
    }
  }

  cancel(): void {
    for (const [id, pending] of this.permissions) {
      clearTimeout(pending.timer);
      this.resolved(id);
      pending.resolve({ decision: "deny", reason: "thread interrupted" });
    }
    this.permissions.clear();
    for (const pending of this.workspaces.splice(0)) pending.resolve({ cancelled: true });
    this.finishWorkspace({ cancelled: true });
  }

  private dispatchWorkspace(): void {
    if (this.activeWorkspace) return;
    const next = this.workspaces.shift();
    if (!next) return;
    this.activeWorkspace = next;
    next.timer = setTimeout(() => this.finishWorkspace({ cancelled: true }), this.timeoutMs);
    this.present({ type: "workspace.requested", requestId: next.id, threadId: this.threadId,
      timestamp: new Date().toISOString(), payload: {
        toolCallId: next.request.toolCallId, prompt: next.request.prompt,
        candidates: next.request.candidates, timeoutMs: this.timeoutMs,
      } });
  }

  private finishWorkspace(result: WorkspaceAskUserResult): void {
    const active = this.activeWorkspace;
    if (!active) return;
    clearTimeout(active.timer);
    this.activeWorkspace = undefined;
    this.resolved(active.id);
    active.resolve(result);
    this.dispatchWorkspace();
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
