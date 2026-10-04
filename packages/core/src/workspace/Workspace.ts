export type Workspace = { id: string; name: string; rootPath: string; createdAt: string };
export type WorkspaceCreation = { workspace: Workspace; created: boolean };
export interface WorkspaceStorage {
  listWorkspaces(): Workspace[];
  getWorkspace(id: string): Workspace | null;
  getWorkspaceByCommand(commandId: string): WorkspaceCreation | null;
  createWorkspace(rootPath: string, commandId?: string): WorkspaceCreation;
}

export type WorkspaceErrorCode = 'invalid_input' | 'not_found' | 'storage_failed';
export class WorkspaceError extends Error {
  constructor(readonly code: WorkspaceErrorCode, message: string) { super(message); }
}
