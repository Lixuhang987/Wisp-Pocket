import type { PermissionDecision, PermissionRequest, AllowPermissionResolution, DenyPermissionResolution, PermissionResolution, PermissionScope, PermissionPolicy } from "./types/Permission.ts";
export type { PermissionDecision, PermissionRequest, AllowPermissionResolution, DenyPermissionResolution, PermissionResolution, PermissionScope, PermissionPolicy } from "./types/Permission.ts";

export class AllowAllPermissionPolicy implements PermissionPolicy {
  async check(): Promise<PermissionDecision> {
    return "allow";
  }

  async resolveAsk(): Promise<PermissionResolution> {
    return { decision: "allow" };
  }

  async remember(): Promise<void> {}
}

export const DENY_TOOL_RESULT_TEXT = "用户拒绝执行该 tool";
