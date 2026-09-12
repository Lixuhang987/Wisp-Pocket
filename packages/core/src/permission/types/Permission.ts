
export type PermissionDecision = "allow" | "deny" | "ask";

export type PermissionRequest = {
  toolName: string;
  arguments: Record<string, unknown>;
  threadId?: string;
  toolCallId: string;
};

export type AllowPermissionResolution = { decision: "allow"; remember?: PermissionScope };
export type DenyPermissionResolution = { decision: "deny"; remember?: PermissionScope; reason?: string };

export type PermissionResolution =
  | AllowPermissionResolution
  | DenyPermissionResolution;

export type PermissionScope = "once" | "always";

export interface PermissionPolicy {
  check(request: PermissionRequest): Promise<PermissionDecision>;
  resolveAsk(request: PermissionRequest): Promise<PermissionResolution>;
  remember(
    request: PermissionRequest,
    resolution: PermissionResolution,
  ): Promise<void>;
}

