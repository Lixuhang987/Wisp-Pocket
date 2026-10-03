import type { Pet } from '../pet/Pet.ts';

export type Workspace = { id: string; name: string; rootPath: string; createdAt: string };
export type WorkspaceCreation = { workspace: Workspace; basePet: Pet; created: boolean };
export interface WorkspaceStorage {
  listWorkspaces(): Workspace[];
  getWorkspace(id: string): Workspace | null;
  getWorkspaceByCommand(commandId: string): WorkspaceCreation | null;
  createWorkspace(rootPath: string, commandId?: string): WorkspaceCreation;
}
