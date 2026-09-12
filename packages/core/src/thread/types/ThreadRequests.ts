import type { PermissionResolution } from "../../permission/PermissionPolicy.ts";
import type { WorkspaceAskResolver, WorkspaceAskUserResult } from "../../tools/builtins/WorkspaceAskUserTool.ts";
export type PermissionPending = {
  resolve: (value: PermissionResolution) => void;
  timer: ReturnType<typeof setTimeout>;
};
export type WorkspacePending = {
  id: string;
  request: Parameters<WorkspaceAskResolver>[0];
  resolve: (result: WorkspaceAskUserResult) => void;
  timer?: ReturnType<typeof setTimeout>;
};
