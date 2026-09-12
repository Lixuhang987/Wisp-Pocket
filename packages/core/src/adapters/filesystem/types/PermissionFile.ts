import type { PermissionRequest, PermissionResolution } from "../../../permission/PermissionPolicy.ts";

export type PersistedRule = {
  toolName: string;
  decision: "allow" | "deny";
  createdAt: string;
};

export type PersistedFile = {
  version: 2;
  rules: PersistedRule[];
};

export type AskResolver = (
  request: PermissionRequest,
) => Promise<PermissionResolution>;

export type FilePermissionPolicyOptions = {
  filePath: string;
  askResolver?: AskResolver;
  now?: () => string;
};

