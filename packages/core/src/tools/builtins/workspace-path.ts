import { isAbsolute } from "node:path";

export function requireWorkspaceRoot(rootPath?: string): string {
  if (!rootPath || !isAbsolute(rootPath)) throw new Error("Thread Workspace rootPath is required");
  return rootPath;
}
